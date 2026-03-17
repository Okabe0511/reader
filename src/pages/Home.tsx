import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBooks, saveBook, deleteBook, checkBookCache, downloadAndCacheBook, type Book } from '../utils/db';
import { BookOpen, Trash2, Plus, Settings, Share2, CheckCircle2, ListChecks, X, DownloadCloud } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import { supabase } from '../lib/supabase';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const extractCover = async (file: File): Promise<string | undefined> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(300 / viewport.width, 1);
    const scaledViewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas as HTMLCanvasElement
    }).promise;
    
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Failed to extract cover:', error);
    return undefined;
  }
};

const Home: React.FC = () => {
  const [books, setBooks] = useState<Omit<Book, 'data'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [downloadingStatus, setDownloadingStatus] = useState<Record<string, 'none' | 'downloading' | 'cached'>>({});
  const navigate = useNavigate();

  const checkAllCaches = async (loadedBooks: Omit<Book, 'data'>[]) => {
    const statuses: Record<string, 'none' | 'downloading' | 'cached'> = {};
    for (const book of loadedBooks) {
      if (book.fileUrl) {
         const cached = await checkBookCache(book.id);
         statuses[book.id] = cached ? 'cached' : 'none';
      }
    }
    setDownloadingStatus(statuses);
  };

  const loadBooks = async () => {
    // 1. Try to load from fast local cache temporarily
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const cacheKey = userId ? `books_cache_${userId}` : 'books_cache';
    
    const cachedBooks = localStorage.getItem(cacheKey);
    if (cachedBooks) {
      const parsed = JSON.parse(cachedBooks);
      setBooks(parsed);
      checkAllCaches(parsed);
      setLoading(false); // Display cached books immediately
    } else {
      setLoading(true);
    }

    // 2. Fetch fresh data from Supabase in the background
    const loadedBooks = await getBooks();
    if (loadedBooks) {
      setBooks(loadedBooks);
      checkAllCaches(loadedBooks);
      localStorage.setItem(cacheKey, JSON.stringify(loadedBooks));
    }
    setLoading(false);
  };

  const handleDownloadAction = async (book: Omit<Book, 'data'>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!book.fileUrl) return;

    setDownloadingStatus(prev => ({ ...prev, [book.id]: 'downloading' }));
    const success = await downloadAndCacheBook(book);
    setDownloadingStatus(prev => ({ ...prev, [book.id]: success ? 'cached' : 'none' }));
    if (!success) alert('下载失败，请重试');
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setIsManaging(false);
      try {
        const coverBase64 = await extractCover(file);
        await saveBook(file.name, file, coverBase64);
        await loadBooks();
      } catch (err) {
        console.error('导入失败', err);
        alert('导入失败');
      }
    } else {
      alert('请上传PDF文件');
    }
    // reset input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这本书吗？')) {
      await deleteBook(id);
      await loadBooks();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBooks.size === 0) return;
    if (window.confirm(`确定要彻底删除选中的 ${selectedBooks.size} 本书吗？`)) {
      setLoading(true);
      await Promise.all(Array.from(selectedBooks).map(id => deleteBook(id)));
      setSelectedBooks(new Set());
      setIsManaging(false);
      await loadBooks();
    }
  };

  const handleShare = async (book: Omit<Book, 'data'>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!book.fileUrl) return alert('该书籍尚未同步到云端，请重新上传后分享。');
    
    // Create a signed URL valid for 7 days (604800 seconds) for external sharing
    const { data, error } = await supabase.storage.from('books').createSignedUrl(book.fileUrl, 604800);
    
    if (error || !data) {
      return alert('生成分享链接失败，请重试');
    }

    const shareTitle = book.name.replace(/\.pdf$/i, '');
    const shareText = `我向你分享了一本书籍《${shareTitle}》，点击链接即可直接下载阅读（7天内有效）：`;

    // 尝试调用系统原生分享 (如果在移动端或 Safari 会弹出原生分享面板，支持直接选微信好友)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: data.signedUrl,
        });
        return; // 分享成功则结束
      } catch (err) {
        // 如果是因为用户主动取消分享，则不必再弹窗，直接退出
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // fallback 降级方案：复制到剪贴板并主动尝试唤醒微信
    try {
      await navigator.clipboard.writeText(`${shareText}\n${data.signedUrl}`);
      // 询问用户是否跳转微信
      if (window.confirm('✅ 分享内容已自动复制到了剪贴板！\n是否立即跳转到微信选择好友粘贴发送？')) {
        // 尝试通过 URL Scheme 唤起微信
        window.location.href = 'weixin://';
      }
    } catch(err) {
      prompt('浏览器不支持自动共享，请手动复制以下链接发送给微信好友 (7天有效)：', data.signedUrl);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedBooks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBooks(next);
  };

  const handleBookClick = (id: string) => {
    if (isManaging) {
      toggleSelection(id);
    } else {
      navigate(`/read/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 font-serif selection:bg-stone-300 pb-20" style={{ backgroundImage: 'radial-gradient(#d6d3cd 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Vintage Header */}
        <header className="flex justify-between items-end mb-16 border-b-[3px] border-stone-300 pb-6 relative min-h-[60px]">
          <div className="absolute w-full h-[1px] bg-stone-300 bottom-1 left-0"></div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 text-stone-900 drop-shadow-sm font-serif italic">
            Library
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {!isManaging ? (
              <>
                <button 
                  onClick={() => setIsManaging(true)}
                  className="p-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-full transition-colors flex items-center gap-1"
                  title="批量管理"
                >
                  <ListChecks size={20} />
                  <span className="hidden sm:inline text-sm font-bold tracking-widest pl-1">管理</span>
                </button>
                <button 
                  onClick={() => navigate('/settings')}
                  className="p-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-full transition-colors"
                  title="设置"
                >
                  <Settings size={20} />
                </button>
                <label className="cursor-pointer group flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-[#4A3C31] text-stone-100 text-sm font-medium rounded-sm shadow-md hover:bg-[#3D3027] transition-all border border-[#2E241D] hover:shadow-lg active:translate-y-[1px]">
                  <Plus size={16} className="opacity-80" />
                  <span className="tracking-wider hidden sm:inline">添加</span>
                  <input 
                    type="file" 
                    accept=".pdf,application/pdf" 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                </label>
              </>
            ) : (
              <button 
                onClick={() => { setIsManaging(false); setSelectedBooks(new Set()); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-stone-200 text-stone-800 text-sm font-medium rounded-sm shadow hover:bg-stone-300 transition-all border border-stone-400"
              >
                <X size={16} />
                <span className="tracking-wider font-bold">取消</span>
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="text-stone-400 py-10 text-sm text-center italic tracking-widest">掸去书架上的灰尘...</div>
        ) : books.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-stone-300 rounded bg-stone-50/60 shadow-inner">
            <BookOpen size={48} className="text-stone-300 mb-4 mx-auto" strokeWidth={1.5} />
            <p className="text-stone-600 mb-2 italic text-lg">书架空空如也，尚无珍藏</p>
            <p className="text-stone-400 text-sm">点击右上角，将您的第一份手稿摆上书架吧</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 sm:gap-x-8 gap-y-8 sm:gap-y-12">
            {books.map(book => (
              <div 
                key={book.id} 
                className="group flex flex-col relative"
              >
                {/* Vintage Book Cover */}
                <div 
                  onClick={() => handleBookClick(book.id)}
                  className={`relative aspect-[2.5/3.5] bg-[#ece9e4] rounded-sm shadow-[3px_4px_8px_rgba(0,0,0,0.15),_inset_4px_0_12px_rgba(0,0,0,0.05)] overflow-hidden cursor-pointer transition-all duration-300 mb-3 border-l-[4px] border-l-[#3D3027] border-r border-t border-b ${isManaging && selectedBooks.has(book.id) ? 'border-[#8b2323] ring-2 ring-[#8b2323] ring-offset-2 ring-offset-stone-100 scale-95' : 'border-stone-300 hover:-translate-y-1'}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent z-10 pointer-events-none mix-blend-overlay"></div>
                  
                  {book.cover ? (
                    <img src={book.cover} alt={book.name} className="w-full h-full object-cover mix-blend-multiply opacity-90 sepia-[0.3] contrast-[0.95]" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/rice-paper.png')]">
                      <BookOpen size={28} className="text-[#8c7b6f] mb-3 opacity-60" strokeWidth={1} />
                      <div className="w-12 h-[1px] bg-[#8c7b6f]/40 mb-2"></div>
                      <span className="text-[10px] text-[#8c7b6f] font-serif uppercase tracking-[0.2em] font-semibold">Volume</span>
                      <div className="w-12 h-[1px] bg-[#8c7b6f]/40 mt-2"></div>
                    </div>
                  )}

                  {/* Red Ribbon Bookmark for Progress */}
                  {book.lastPage && (
                    <div 
                      className="absolute -top-1 left-4 w-5 h-16 bg-[#8b2323] shadow-md z-20 transition-all duration-300 group-hover:h-20" 
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%)' }}
                    >
                      <div className="absolute bottom-2 w-full text-center text-[10px] text-white/90 font-mono font-bold">
                        {book.lastPage}
                      </div>
                    </div>
                  )}
                  
                  {/* Subtle Page Edges Effect */}
                  <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-[repeating-linear-gradient(to_bottom,#d6d3cd,#d6d3cd_1px,#fff_1px,#fff_2px)] z-10 pointer-events-none"></div>

                  {/* Management Checkbox Overlay */}
                  {isManaging && (
                    <div className="absolute top-2 right-2 z-30">
                       <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedBooks.has(book.id) ? 'bg-[#8b2323] border-[#8b2323]' : 'bg-white/80 border-stone-400'}`}>
                          {selectedBooks.has(book.id) && <CheckCircle2 size={16} className="text-white" />}
                       </div>
                    </div>
                  )}
                </div>
                
                {/* Book Info */}
                <div className="flex justify-between items-start mt-1 px-1">
                  <div className="pr-2 flex-grow">
                    <h3 
                      className="font-bold text-[15px] text-stone-800 leading-snug line-clamp-2 mb-1 cursor-pointer hover:text-[#8b2323] transition-colors decoration-stone-300 underline-offset-4 group-hover:underline"
                      onClick={() => handleBookClick(book.id)}
                      title={book.name}
                    >
                      {book.name.replace(/\.pdf$/i, '')}
                    </h3>
                  </div>

                  {!isManaging && (
                    <div className={`flex items-center flex-shrink-0 transition-opacity ${downloadingStatus[book.id] === 'downloading' || downloadingStatus[book.id] === 'cached' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {downloadingStatus[book.id] === 'cached' ? (
                        <div className="text-[#4A3C31] p-1.5" title="已缓存至本地">
                          <CheckCircle2 size={15} />
                        </div>
                      ) : downloadingStatus[book.id] === 'downloading' ? (
                        <div className="text-blue-600 p-1.5 animate-pulse" title="下载中...">
                          <DownloadCloud size={15} />
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => handleDownloadAction(book, e)}
                          className="text-stone-400 hover:text-stone-800 p-1.5 rounded-full hover:bg-stone-200 transition-colors"
                          title="下载至本地离线阅读"
                        >
                          <DownloadCloud size={15} />
                        </button>
                      )}

                      <button 
                        onClick={(e) => handleShare(book, e)}
                        className="text-stone-400 hover:text-blue-700 p-1.5 rounded-full hover:bg-blue-50 transition-colors"
                        title="复制链接分享到微信"
                      >
                        <Share2 size={15} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(book.id, e)}
                        className="text-stone-400 hover:text-red-700 p-1.5 rounded-full hover:bg-stone-200 transition-colors"
                        title="彻底移出书架"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Bar for Managing */}
      {isManaging && (
        <div className="fixed bottom-0 left-0 w-full bg-[#ece9e4]/95 backdrop-blur-sm border-t border-stone-300 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-50 flex justify-center animate-in slide-in-from-bottom-10">
           <div className="w-full max-w-5xl px-6 flex justify-between items-center">
             <div className="text-stone-800 font-bold border-l-4 border-[#4A3C31] pl-3">
               已选中 <span className="text-[#8b2323] text-lg mx-1">{selectedBooks.size}</span> 本书籍
             </div>
             <button 
               className="px-8 py-2.5 bg-[#8b2323] text-stone-100 font-bold rounded-sm shadow disabled:opacity-50 disabled:bg-stone-400 hover:bg-red-800 transition-all flex items-center gap-2"
               disabled={selectedBooks.size === 0}
               onClick={handleBulkDelete}
             >
               <Trash2 size={18} />
               批量删除
             </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Home;