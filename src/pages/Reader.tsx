import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getBook, updateBookPage, type Book } from '../utils/db';
import { translateWord } from '../utils/translate';
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, Volume2, Sun, Moon } from 'lucide-react';
import { Coffee } from 'lucide-react';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const Reader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedWord, setSelectedWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, show: false });
  const [containerWidth, setContainerWidth] = useState(800);
  const [scale, setScale] = useState(1.0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  type Theme = 'light' | 'sepia' | 'dark';
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem('reader_theme') as Theme) || 'light'
  );

  useEffect(() => {
    localStorage.setItem('reader_theme', theme);
  }, [theme]);

  const themeOption = {
    light: {
      appBg: 'bg-gray-100',
      headerBg: 'bg-white',
      textColor: 'text-gray-800',
      btnHover: 'hover:bg-gray-100',
      scrollBg: 'bg-gray-100',
      pdfFilter: 'none',
      iconColor: 'text-gray-600',
    },
    sepia: {
      appBg: 'bg-[#f4ecd8]',
      headerBg: 'bg-[#ebe3cd]',
      textColor: 'text-stone-800',
      btnHover: 'hover:bg-[#dfd7c0]',
      scrollBg: 'bg-[#f4ecd8]',
      pdfFilter: 'sepia(0.3) contrast(0.9) brightness(0.95)',
      iconColor: 'text-stone-600',
    },
    dark: {
      appBg: 'bg-gray-950',
      headerBg: 'bg-gray-900 border-b border-gray-800',
      textColor: 'text-gray-300',
      btnHover: 'hover:bg-gray-800',
      scrollBg: 'bg-gray-950',
      pdfFilter: 'invert(0.9) hue-rotate(180deg) brightness(1.1) contrast(1.05)',
      iconColor: 'text-gray-400',
    }
  }[theme];

  const cycleTheme = () => {
    if (theme === 'light') setTheme('sepia');
    else if (theme === 'sepia') setTheme('dark');
    else setTheme('light');
  };

  useEffect(() => {
    if (id) {
      getBook(id).then(data => {
        if (data && data.data) {
          setBook(data);
          if (data.lastPage) {
            setPageNumber(data.lastPage);
          }
          let pdfData: Uint8Array | ArrayBuffer = data.data;
          if (!(pdfData instanceof Uint8Array) && !(pdfData instanceof ArrayBuffer)) {
            pdfData = new Uint8Array(Object.values(data.data as unknown as Record<string, number>));
          }
          const blob = new Blob([pdfData as BlobPart], { type: 'application/pdf' });
          setPdfUrl(URL.createObjectURL(blob));
        }
        else navigate('/');
      });
    }
  }, [id, navigate]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (id && book) {
      updateBookPage(id, pageNumber);
    }
  }, [id, pageNumber, book]);

  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ignore clicks on buttons or inside tooltip
      if (target.closest('button') || target.closest('.translation-tooltip')) {
        return;
      }

      // Pagination clicks on the 25% left/right edges
      const vw = window.innerWidth;
      const x = e.clientX;
      const isLeftClick = x < vw * 0.25;
      const isRightClick = x > vw * 0.75;

      let validSelection = false;
      let foundWord = '';
      let wordRect: DOMRect | undefined;

      // Check for translation (selected text or single click)
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const text = selection.toString().trim();
        if (text.length > 0 && text.length < 50 && /^[a-zA-Z\s-]+$/.test(text)) {
          foundWord = text;
          wordRect = selection.getRangeAt(0).getBoundingClientRect();
          validSelection = true;
        }
      } else {
        // Single click text detection using point range
        if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer;
            const text = textNode.nodeValue || '';
            const offset = range.startOffset;

            // Find the word bounds around offset
            const match = text.match(/[a-zA-Z-]+/g);
            if (match) {
              const regex = /[a-zA-Z-]+/g;
              let m;
              let isWordClicked = false;
              while ((m = regex.exec(text)) !== null) {
                if (offset >= m.index && offset <= m.index + m[0].length) {
                  foundWord = m[0];
                  const wordRange = document.createRange();
                  wordRange.setStart(textNode, m.index);
                  wordRange.setEnd(textNode, m.index + m[0].length);
                  wordRect = wordRange.getBoundingClientRect();
                  
                  // Check if the click is actually ON the word rect 
                  // to prevent firing when clicking margin next to a line of text
                  if (
                    e.clientX >= wordRect.left - 5 && e.clientX <= wordRect.right + 5 &&
                    e.clientY >= wordRect.top - 5 && e.clientY <= wordRect.bottom + 5
                  ) {
                    isWordClicked = true;
                    validSelection = true;
                  }
                  break;
                }
              }
              if (!isWordClicked) {
                 validSelection = false;
              }
            }
          }
        }
      }

      if (validSelection && foundWord && wordRect) {
        setTooltipPos({
          x: wordRect.left + wordRect.width / 2,
          y: wordRect.top - 10,
          show: true
        });
        setSelectedWord(foundWord);
        setTranslation('翻译中...');

        const translated = await translateWord(foundWord);
        setTranslation(translated);
      } else {
        setTooltipPos(prev => ({ ...prev, show: false }));

        if (isLeftClick) {
          setPageNumber(p => {
            if (p > 1) {
              setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              return p - 1;
            }
            return p;
          });
        } else if (isRightClick) {
          setPageNumber(p => {
            if (numPages && p < numPages) {
              setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              return p + 1;
            }
            return p;
          });
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPageNumber(p => {
          if (p > 1) {
            setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
            return p - 1;
          }
          return p;
        });
      } else if (e.key === 'ArrowRight') {
        setPageNumber(p => {
          if (numPages && p < numPages) {
            setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
            return p + 1;
          }
          return p;
        });
      }
    };

    document.addEventListener('mouseup', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [numPages]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        // 手机屏幕不再额外减去边距，充分利用屏幕宽度
        const margin = width < 640 ? 0 : 40;
        setContainerWidth(Math.min(width - margin, 800));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发点击外部关闭气泡
    if (!selectedWord || isPlayingAudio) return;
    
    setIsPlayingAudio(true);
    const accent = localStorage.getItem('pronunciation_accent') === 'uk' ? '1' : '0'; // 1是英音, 0是美音 (默认)
    // 采用有道公共语音接口
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(selectedWord)}&type=${accent}`;
    
    const audio = new Audio(audioUrl);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    audio.play().catch(err => {
      console.error('Audio play failed:', err);
      setIsPlayingAudio(false);
    });
  };

  if (!book || !pdfUrl) {
    return (
      <div className={`h-screen flex items-center justify-center ${themeOption.appBg}`}>
        <Loader2 className={`animate-spin ${themeOption.iconColor} mr-2`} />
        <span className={themeOption.textColor}>加载阅读器中...</span>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col relative overflow-hidden transition-colors duration-300 ${themeOption.appBg}`} ref={containerRef}>
      {/* Header */}
      <div className={`h-14 flex items-center px-2 sm:px-4 shrink-0 z-10 sticky top-0 transition-colors duration-300 ${themeOption.headerBg}`}>
        <button 
          onClick={() => navigate('/')} 
          className={`p-1 sm:p-2 rounded-full transition-colors mr-1 sm:mr-3 ${themeOption.iconColor} ${themeOption.btnHover}`}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className={`text-sm sm:text-lg font-medium truncate flex-1 ${themeOption.textColor}`} title={book.name}>
          {book.name}
        </h1>
        <div className={`ml-2 sm:ml-auto flex items-center gap-1 sm:gap-4 text-xs sm:text-sm shrink-0 ${themeOption.textColor}`}>
          <span className="hidden md:inline text-xs opacity-60 mr-2">点击或划选英文单词进行翻译</span>
          
          {/* Theme Toggle */}
          <button
            onClick={cycleTheme}
            className={`p-1 sm:p-1.5 rounded-full transition-colors mr-1 ${themeOption.btnHover} ${themeOption.iconColor}`}
            title="切换阅读主题"
          >
            {theme === 'light' && <Sun size={16} />}
            {theme === 'sepia' && <Coffee size={16} />}
            {theme === 'dark' && <Moon size={16} />}
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center rounded mr-1 opacity-80">
            <button 
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))} 
              className={`p-1 sm:p-1.5 rounded disabled:opacity-30 ${themeOption.btnHover}`}
              disabled={scale <= 0.5}
            >
              <ZoomOut size={14} />
            </button>
            <span className="w-9 sm:w-11 text-center font-mono text-[10px] sm:text-xs">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={() => setScale(s => Math.min(3.0, s + 0.1))} 
              className={`p-1 sm:p-1.5 rounded disabled:opacity-30 ${themeOption.btnHover}`}
              disabled={scale >= 3.0}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <span className="w-10 sm:w-auto text-center">{pageNumber} <span className="hidden sm:inline">/ {numPages || '-'}</span></span>
        </div>
      </div>

      {/* PDF Viewer */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-auto py-2 sm:py-6 custom-scrollbar text-center transition-colors duration-300 ${themeOption.scrollBg}`}
      >
        <div 
          className="inline-block relative rounded-sm group text-left transition-all duration-300"
          style={{ 
            filter: themeOption.pdfFilter,
            boxShadow: theme === 'dark' ? '0 10px 25px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.1)'
          }}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={error => console.error('PDF加载错误:', error)}
            loading={
              <div className={`flex items-center justify-center p-20 ${themeOption.textColor} opacity-60`}>
                <Loader2 className="animate-spin mr-2" /> 渲染网页中...
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={containerWidth}
            />
          </Document>
        </div>
      </div>

      {/* Translation Tooltip */}
      {tooltipPos.show && (
        <div 
          className="translation-tooltip fixed z-50 bg-gray-900 text-white px-2 py-1.5 rounded-md shadow-xl text-xs max-w-[80vw] sm:max-w-xs pointer-events-auto transform -translate-x-1/2 -translate-y-full flex flex-col gap-0.5 border border-gray-700"
          style={{ 
            left: Math.max(0, tooltipPos.x), 
            top: tooltipPos.y,
            transition: 'top 0.1s ease-out, left 0.1s ease-out'
          }}
        >
          <div className="font-semibold text-blue-200 flex items-center justify-between gap-3">
            <span>{selectedWord}</span>
            <button 
              onClick={handlePlayAudio}
              disabled={isPlayingAudio}
              className={`p-1 rounded-full ${isPlayingAudio ? 'text-blue-400' : 'text-gray-300 hover:text-white hover:bg-gray-700'} transition-colors`}
              title="发音"
            >
              <Volume2 size={14} className={isPlayingAudio ? 'animate-pulse' : ''} />
            </button>
          </div>
          <div className="text-gray-100 break-words">{translation}</div>
          {/* Arrow */}
          <div 
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 border-r border-b border-gray-700 pointer-events-none"
          />
        </div>
      )}
    </div>
  );
};

export default Reader;