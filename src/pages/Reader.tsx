import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getBook, updateBookPage, type Book } from '../utils/db';
import { translateWord } from '../utils/translate';
import { ArrowLeft, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
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
            pdfData = new Uint8Array(Object.values(data.data as any));
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
        if (text.length > 0 && text.length < 50 && /^[a-zA-Z\s\-]+$/.test(text)) {
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
            const match = text.match(/[a-zA-Z\-]+/g);
            if (match) {
              const regex = /[a-zA-Z\-]+/g;
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

  if (!book || !pdfUrl) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-500 mr-2" />
        <span className="text-gray-500">加载阅读器中...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative overflow-hidden" ref={containerRef}>
      {/* Header */}
      <div className="h-14 bg-white shadow-sm flex items-center px-2 sm:px-4 shrink-0 z-10 sticky top-0">
        <button 
          onClick={() => navigate('/')} 
          className="p-1 sm:p-2 hover:bg-gray-100 rounded-full transition-colors mr-1 sm:mr-3 text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm sm:text-lg font-medium text-gray-800 truncate flex-1" title={book.name}>
          {book.name}
        </h1>
        <div className="ml-2 sm:ml-auto flex items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-600 shrink-0">
          <span className="hidden md:inline text-xs text-gray-400 mr-2">点击或划选英文单词进行翻译</span>
          
          {/* Zoom Controls */}
          <div className="flex items-center bg-gray-100 rounded mr-1">
            <button 
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))} 
              className="p-1 sm:p-1.5 hover:bg-gray-200 rounded disabled:opacity-50"
              disabled={scale <= 0.5}
            >
              <ZoomOut size={14} />
            </button>
            <span className="w-9 sm:w-11 text-center font-mono text-[10px] sm:text-xs">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={() => setScale(s => Math.min(3.0, s + 0.1))} 
              className="p-1 sm:p-1.5 hover:bg-gray-200 rounded disabled:opacity-50"
              disabled={scale >= 3.0}
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <button 
            disabled={pageNumber <= 1} 
            onClick={() => {
              setPageNumber(p => p - 1);
              scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            上页
          </button>
          <span className="w-10 sm:w-auto text-center">{pageNumber} <span className="hidden sm:inline">/ {numPages || '-'}</span></span>
          <button 
            disabled={pageNumber >= numPages} 
            onClick={() => {
              setPageNumber(p => p + 1);
              scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            下页
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-auto bg-gray-100 py-2 sm:py-6 custom-scrollbar text-center"
      >
        <div className="inline-block bg-white shadow-lg relative rounded-sm group text-left">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={error => console.error('PDF加载错误:', error)}
            loading={
              <div className="flex items-center justify-center p-20 text-gray-400">
                <Loader2 className="animate-spin mr-2" /> 渲染中...
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
          className="translation-tooltip fixed z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl text-sm max-w-sm pointer-events-none transform -translate-x-1/2 -translate-y-full flex flex-col gap-1 border border-gray-700"
          style={{ 
            left: Math.max(0, tooltipPos.x), 
            top: tooltipPos.y,
            transition: 'top 0.1s ease-out, left 0.1s ease-out'
          }}
        >
          <div className="font-semibold text-blue-200">{selectedWord}</div>
          <div className="text-gray-100 break-words">{translation}</div>
          {/* Arrow */}
          <div 
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 border-r border-b border-gray-700"
          />
        </div>
      )}
    </div>
  );
};

export default Reader;