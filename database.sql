-- Create books table
CREATE TABLE books (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  cover TEXT,
  file_url TEXT NOT NULL,
  last_page INTEGER DEFAULT 1,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own books." 
ON books FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own books." 
ON books FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own books." 
ON books FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books." 
ON books FOR DELETE 
USING (auth.uid() = user_id);

-- Set up Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('books', 'books', true);

CREATE POLICY "Users can upload their own books" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'books' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own books" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'books' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own books" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'books' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
