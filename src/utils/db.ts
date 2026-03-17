import { supabase } from '../lib/supabase';
import localforage from 'localforage';

export interface Book {
  id: string;
  name: string;
  data?: ArrayBuffer;
  addedAt?: number;
  lastPage?: number;
  cover?: string;
  fileUrl?: string;
}

export const saveBook = async (name: string, file: File, cover?: string) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not logged in');

  const userId = userData.user.id;
  const fileExt = file.name.split('.').pop() || 'pdf';
  // Use a unique name for storage to prevent collisions
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  // 1. Upload file to Supabase Storage bucket ('books')
  const { error: uploadError } = await supabase.storage
    .from('books')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  // 2. Insert record into Postgres DB
  const { data, error: insertError } = await supabase.from('books')
    .insert([
      {
        user_id: userId,
        name: name,
        cover: cover,
        file_url: fileName,
        last_page: 1
      }
    ])
    .select()
    .single();

  if (insertError) throw insertError;
  return data.id;
};

export const getBooks = async () => {
  // Current user token is automatically sent and bounded by RLS! 
  // It only fetches the current logged-in user's books.
  const { data, error } = await supabase.from('books')
    .select('*')
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error fetching books:', error);
    return [];
  }

  return data.map(b => ({
    id: b.id,
    name: b.name,
    cover: b.cover,
    lastPage: b.last_page,
    addedAt: new Date(b.added_at).getTime(),
    fileUrl: b.file_url
  }));
};

export const getBook = async (id: string) => {
  // Fetch book metadata
  const { data: book, error } = await supabase.from('books').select('*').eq('id', id).single();
  if (error || !book) return null;

  let arrayBuffer: ArrayBuffer | null = null;
  const cacheKey = `book_data_${id}_${book.file_url}`;
  
  try {
    const cachedData = await localforage.getItem<ArrayBuffer>(cacheKey);
    if (cachedData) {
      arrayBuffer = cachedData;
    }
  } catch (err) {
    console.warn('Failed to read from cache', err);
  }

  if (!arrayBuffer) {
    // Download actual PDF binary from Storage
    const { data: fileData, error: downloadError } = await supabase.storage.from('books').download(book.file_url);
    if (downloadError) {
      console.error('Download error:', downloadError);
      return null;
    }

    arrayBuffer = await fileData.arrayBuffer();
    
    try {
      await localforage.setItem(cacheKey, arrayBuffer);
    } catch (err) {
      console.warn('Failed to save to cache', err);
    }
  }
  
  return {
    id: book.id,
    name: book.name,
    cover: book.cover,
    lastPage: book.last_page,
    data: arrayBuffer
  } as Book;
};

export const checkBookCache = async (id: string, fileUrl: string): Promise<boolean> => {
  try {
    const key = `book_data_${id}_${fileUrl}`;
    const keys = await localforage.keys();
    return keys.includes(key);
  } catch (err) {
    return false;
  }
};

export const downloadAndCacheBook = async (id: string, fileUrl: string): Promise<boolean> => {
  // Check if it's already there
  const isCached = await checkBookCache(id, fileUrl);
  if (isCached) return true;

  // Download actual PDF binary from Storage
  const { data: fileData, error: downloadError } = await supabase.storage.from('books').download(fileUrl);
  if (downloadError || !fileData) {
    console.error('Download error:', downloadError);
    return false;
  }

  const arrayBuffer = await fileData.arrayBuffer();
  try {
    const cacheKey = `book_data_${id}_${fileUrl}`;
    await localforage.setItem(cacheKey, arrayBuffer);
    return true;
  } catch (err) {
    console.warn('Failed to save to cache', err);
    return false;
  }
};
export const deleteBook = async (id: string) => {
  // Find the file path
  const { data: book } = await supabase.from('books').select('file_url').eq('id', id).single();
  
  if (book && book.file_url) {
    // Delete file from Storage
    await supabase.storage.from('books').remove([book.file_url]);
    
    // Clear local cache
    try {
      await localforage.removeItem(`book_data_${id}_${book.file_url}`);
    } catch (err) {
      console.warn('Failed to clear cache for deleted book', err);
    }
  }
  
  // Delete row from Database
  await supabase.from('books').delete().eq('id', id);
};

export const updateBookPage = async (id: string, pageNumber: number) => {
  const { error } = await supabase.from('books').update({ last_page: pageNumber }).eq('id', id);
  if (error) console.error('Error updating page:', error);
};
