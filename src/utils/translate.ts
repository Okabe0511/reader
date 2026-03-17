export const translateWord = async (word: string): Promise<string> => {
  if (!word || !word.trim()) return '';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const targetWord = word.trim().toLowerCase();

    const res = await fetch(
      `/api/dict/suggest?q=${encodeURIComponent(targetWord)}&num=1&doctype=json`,
      { signal: controller.signal }
    );
    
    const data = await res.json();
    
    if (data?.data?.entries && data.data.entries.length > 0) {
      const explain = data.data.entries[0].explain;
      if (explain) {
         clearTimeout(timeoutId);
         return explain;
      }
    }
    
    const fyRes = await fetch(
      `/api/fanyi/translate?doctype=json&type=AUTO&i=${encodeURIComponent(targetWord)}`,
      { signal: controller.signal }
    );
    const fyData = await fyRes.json();
    clearTimeout(timeoutId);

    if (fyData?.translateResult?.[0]?.[0]?.tgt) {
      return fyData.translateResult[0][0].tgt;
    }

    return '未找到翻译';
  } catch (err) {
    console.error('Translation error:', err);
    return '网络异常或被拦截';
  }
};