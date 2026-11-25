export type ToolCategory =
  | 'Workflows'
  | 'Organize PDF'
  | 'Optimize PDF'
  | 'Convert PDF'
  | 'Edit PDF'
  | 'PDF Security'
  | 'PDF Intelligence'
  | 'Generators'
  | 'Text & Writing'
  | 'Calculators';

export type ToolIconName =
  | 'Workflow'
  | 'Files'
  | 'Scissors'
  | 'LayoutGrid'
  | 'RotateCw'
  | 'Crop'
  | 'Minimize2'
  | 'Wrench'
  | 'ImageDown'
  | 'FileImage'
  | 'Images'
  | 'ScanLine'
  | 'FileCode2'
  | 'FileSpreadsheet'
  | 'FilePenLine'
  | 'Stamp'
  | 'Hash'
  | 'ClipboardList'
  | 'PenTool'
  | 'EyeOff'
  | 'ScanText'
  | 'GitCompare'
  | 'QrCode'
  | 'FileText'
  | 'CalendarClock';

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface ToolDefinition {
  id: string;
  slug: string;
  path: string;
  name: string;
  shortDescription: string;
  category: ToolCategory;
  iconName: ToolIconName;
  primaryKeyword: string;
  secondaryKeywords: string[];
  seoTitle: string;
  seoDescription: string;
  supportedFormats: string;
  limitsSummary: string;
  howToSteps: string[];
  faqs: ToolFaq[];
}

export const TOOL_CATEGORIES: Array<'All' | ToolCategory> = [
  'All',
  'Workflows',
  'Organize PDF',
  'Optimize PDF',
  'Convert PDF',
  'Edit PDF',
  'PDF Security',
  'PDF Intelligence',
  'Generators',
  'Text & Writing',
  'Calculators',
];

export const TOOLS: ToolDefinition[] = [
  // ===================== WORKFLOWS =====================
  {
    id: 'pdf-workflow',
    slug: 'pdf-workflow',
    path: '/tools/pdf-workflow',
    name: 'PDF Workflow',
    shortDescription:
      'Automate multi-step PDF tasks in one browser pass: merge multiple PDFs, rotate pages, stamp watermarks, add page numbers, and optimize.',
    category: 'Workflows',
    iconName: 'Workflow',
    primaryKeyword: 'pdf workflow automation online',
    secondaryKeywords: [
      'batch pdf pipeline',
      'merge watermark number pdf',
      'chained pdf tools browser',
    ],
    seoTitle: 'PDF Workflow Automation – Chain Merge, Watermark & Numbering | ToolMitra',
    seoDescription:
      'Run multi-step PDF pipelines directly in your browser. Merge PDFs, rotate pages, add text watermarks, insert page numbers, and optimize output in one click.',
    supportedFormats: 'Input: 1–15 unencrypted PDFs · Output: Processed PDF (.pdf)',
    limitsSummary: 'Up to 15 PDFs (50 MB each) · Executes sequentially in browser memory',
    howToSteps: [
      'Add one or more PDF files in the order you want them processed.',
      'Enable the pipeline actions you need: page rotation, text watermark, page numbering, or stream optimization.',
      'Click Run PDF Workflow and download the finished document in a single pass.',
    ],
    faqs: [
      {
        question: 'Does PDF Workflow run all steps on my own device?',
        answer:
          'Yes. Merging, rotation, watermarking, page numbering, and lossless optimization all execute sequentially inside your browser memory without file uploads.',
      },
      {
        question: 'Can I use PDF Workflow on a single PDF without merging?',
        answer:
          'Yes. Upload one PDF, enable any combination of rotate, watermark, page numbers, or structure optimization, and run the pipeline.',
      },
      {
        question: 'In what order do the workflow steps run?',
        answer:
          'Files are merged first (when multiple PDFs are added), then rotated, stamped with your watermark, numbered across final pages, and optimized.',
      },
    ],
  },

  // ===================== ORGANIZE PDF =====================
  {
    id: 'merge-pdf',
    slug: 'merge-pdf',
    path: '/tools/merge-pdf',
    name: 'Merge PDF',
    shortDescription:
      'Combine multiple PDF documents into one ordered PDF file in your browser with page counts, drag-and-drop reordering, and instant download.',
    category: 'Organize PDF',
    iconName: 'Files',
    primaryKeyword: 'merge pdf online free',
    secondaryKeywords: [
      'combine pdf files',
      'join pdf documents in browser',
      'merge pdf without upload',
    ],
    seoTitle: 'Merge PDF Online Free – Combine PDF Files Privately | ToolMitra',
    seoDescription:
      'Merge multiple PDF files into a single document directly in your browser. Reorder PDFs, check page counts, and download cleanly with zero file uploads.',
    supportedFormats: 'PDF (.pdf) · Standard unencrypted PDF documents',
    limitsSummary:
      'Up to 25 PDFs per merge · Max 50 MB per file (150 MB total) · Processed locally',
    howToSteps: [
      'Select or drag and drop two or more PDF files from your device.',
      'Check page counts and reorder your PDF files using drag handles or the up/down buttons.',
      'Click Merge PDFs and download your combined document immediately.',
    ],
    faqs: [
      {
        question: 'Are my PDF files uploaded to a server when merging?',
        answer:
          'No. ToolMitra merges PDF pages locally inside your browser memory using pdf-lib, so your documents stay strictly on your device.',
      },
      {
        question: 'Can I control the order of the merged PDF pages?',
        answer:
          'Yes. Drag rows or use the up and down arrow buttons to arrange files in the exact sequence you want before clicking Merge PDFs.',
      },
      {
        question: 'Why are password-protected PDFs rejected?',
        answer:
          'Encrypted PDFs cannot have their pages copied without first removing the password. Unlock protected files beforehand and upload them again.',
      },
      {
        question: 'Is there a watermark or page limit added by ToolMitra?',
        answer:
          'No watermarks or branding pages are added. To keep browser memory responsive, each merge supports up to 25 files, 50 MB per file, and 150 MB combined.',
      },
    ],
  },
  {
    id: 'split-pdf',
    slug: 'split-pdf',
    path: '/tools/split-pdf',
    name: 'Split PDF',
    shortDescription:
      'Extract specific pages, split by custom ranges, or divide a PDF every N pages directly in your browser with single PDF or ZIP download.',
    category: 'Organize PDF',
    iconName: 'Scissors',
    primaryKeyword: 'split pdf online free',
    secondaryKeywords: [
      'extract pages from pdf',
      'divide pdf into separate files',
      'pdf page splitter browser',
    ],
    seoTitle: 'Split PDF Online Free – Extract & Divide PDF Pages | ToolMitra',
    seoDescription:
      'Split PDF files by page ranges, fixed intervals, or individual page selection in your browser. Download extracted PDFs individually or as a ZIP with no uploads.',
    supportedFormats: 'PDF (.pdf) · Standard unencrypted PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Instant page extraction locally in memory',
    howToSteps: [
      'Drop or select a PDF document from your device to view its total page count.',
      'Pick Page Ranges (e.g., 1-3, 5), Split Every N Pages, or Select Pages from the grid.',
      'Click Split PDF and download individual PDFs or a combined ZIP archive.',
    ],
    faqs: [
      {
        question: 'Are my PDF documents uploaded to a server when splitting?',
        answer:
          'No. ToolMitra extracts and splits PDF pages directly inside your browser memory using pdf-lib, so your files never leave your device.',
      },
      {
        question: 'Can I extract non-consecutive pages into one PDF?',
        answer:
          'Yes. Use Page Ranges (such as 1-2, 5, 9-10) or Select Pages with the "Combine into one PDF" option to save only those pages into a single file.',
      },
      {
        question: 'How do I split every single page into its own PDF file?',
        answer:
          'Switch to the "Split Every N Pages" tab, keep the value set to 1, click Split PDF, and download all generated files together with Download All (ZIP).',
      },
      {
        question: 'Can I split a password-protected PDF?',
        answer:
          'Encrypted PDFs require unlocking before their pages can be copied. Remove password protection first, then upload the PDF to split it.',
      },
    ],
  },
  {
    id: 'organize-pdf',
    slug: 'organize-pdf',
    path: '/tools/organize-pdf',
    name: 'Organize PDF',
    shortDescription:
      'Reorder, duplicate, delete, and rotate individual PDF pages in a visual thumbnail workspace before saving your updated document.',
    category: 'Organize PDF',
    iconName: 'LayoutGrid',
    primaryKeyword: 'organize pdf pages online',
    secondaryKeywords: [
      'reorder pdf pages',
      'delete pages from pdf',
      'duplicate and rearrange pdf',
    ],
    seoTitle: 'Organize PDF Pages – Reorder, Delete & Duplicate | ToolMitra',
    seoDescription:
      'Visually organize PDF pages in your browser. Move pages left or right, duplicate key sheets, delete unwanted pages, rotate sideways scans, and save immediately.',
    supportedFormats: 'PDF (.pdf) · Unencrypted single PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Visual thumbnails up to 40 pages · Local processing',
    howToSteps: [
      'Upload or drop a PDF file to display page cards and thumbnails.',
      'Drag or nudge pages into order, rotate individual sheets, duplicate pages, or delete blank pages.',
      'Click Save Organized PDF to generate and download your updated document.',
    ],
    faqs: [
      {
        question: 'Can I reorder pages from a PDF over 40 pages?',
        answer:
          'Yes. All pages load into the organizer list; visual previews render for the first 40 pages to keep memory fast, while every page can still be reordered, rotated, or removed.',
      },
      {
        question: 'Does deleting pages leave gaps in my PDF?',
        answer:
          'No. Deleted pages are removed cleanly and the remaining pages are re-indexed in sequence inside the saved PDF.',
      },
      {
        question: 'Are edits lossless for text and vector graphics?',
        answer:
          'Yes. Organize PDF copies original page objects via pdf-lib without re-rasterizing fonts or diagrams.',
      },
    ],
  },
  {
    id: 'rotate-pdf',
    slug: 'rotate-pdf',
    path: '/tools/rotate-pdf',
    name: 'Rotate PDF',
    shortDescription:
      'Fix sideways or upside-down PDF pages permanently in your browser—rotate all pages or adjust individual pages losslessly.',
    category: 'Organize PDF',
    iconName: 'RotateCw',
    primaryKeyword: 'rotate pdf online free',
    secondaryKeywords: [
      'rotate pdf pages permanently',
      'turn sideways pdf upright',
      'rotate single pdf page',
    ],
    seoTitle: 'Rotate PDF Online Free – Fix Sideways PDF Pages | ToolMitra',
    seoDescription:
      'Rotate all PDF pages or individual pages 90° left, 90° right, or 180° directly in your browser. Preview orientation live and save losslessly with zero uploads.',
    supportedFormats: 'PDF (.pdf) · Standard unencrypted PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Lossless page rotation in browser memory',
    howToSteps: [
      'Upload or drop your PDF document to load page previews and current orientation.',
      'Use bulk controls to rotate all pages together, or rotate individual pages 90° left or right.',
      'Click Apply Rotation and download your permanently oriented PDF file.',
    ],
    faqs: [
      {
        question: 'Does rotating a PDF reduce text or image quality?',
        answer:
          'No. Rotate PDF updates each page rotation flag losslessly via pdf-lib, preserving original fonts, vector drawings, and image resolution.',
      },
      {
        question: 'Can I rotate just one or two pages instead of the whole document?',
        answer:
          'Yes. Every page card has its own −90° and +90° buttons so you can fix specific sideways scans while leaving upright pages unchanged.',
      },
      {
        question: 'Are rotated PDFs saved permanently?',
        answer:
          'Yes. Downloading the output PDF saves the updated page orientation metadata inside the PDF file so every viewer opens it upright.',
      },
      {
        question: 'Do my files leave my computer or phone?',
        answer:
          'No. Thumbnail rendering and rotation saving happen locally inside your browser.',
      },
    ],
  },
  {
    id: 'crop-pdf',
    slug: 'crop-pdf',
    path: '/tools/crop-pdf',
    name: 'Crop PDF',
    shortDescription:
      'Trim extra white borders or unwanted page headers and footers across all pages or custom ranges with a live crop overlay preview.',
    category: 'Organize PDF',
    iconName: 'Crop',
    primaryKeyword: 'crop pdf pages online',
    secondaryKeywords: [
      'trim pdf margins',
      'remove white borders from pdf',
      'cut pdf page area',
    ],
    seoTitle: 'Crop PDF Online Free – Trim PDF Page Margins Privately | ToolMitra',
    seoDescription:
      'Adjust top, right, bottom, and left crop margins on PDF pages with live visual preview in your browser. Save trimmed pages cleanly without file uploads.',
    supportedFormats: 'PDF (.pdf) · Unencrypted PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Non-destructive PDF CropBox trimming',
    howToSteps: [
      'Select a PDF document to preview its first page and page dimensions.',
      'Adjust Top, Bottom, Left, and Right crop sliders or pick a preset margin trim.',
      'Apply to all pages or specific ranges and download your cropped PDF.',
    ],
    faqs: [
      {
        question: 'How does Crop PDF trim page borders?',
        answer:
          'It updates the PDF page CropBox (and MediaBox dimensions visually displayed by viewers) by the exact percentages you choose across target pages.',
      },
      {
        question: 'Can I crop only specific pages such as title slides or receipts?',
        answer:
          'Yes. Switch Target Pages to Custom Range (for example 2-5, 8) so only those pages are trimmed.',
      },
      {
        question: 'Does cropping blur text or downgrade image resolution?',
        answer:
          'No. Updating page boxes is lossless and keeps all underlying fonts and embedded graphics crisp.',
      },
    ],
  },

  // ===================== OPTIMIZE PDF =====================
  {
    id: 'compress-pdf',
    slug: 'compress-pdf',
    path: '/tools/compress-pdf',
    name: 'Compress PDF',
    shortDescription:
      'Reduce PDF file size in your browser using lossless stream cleanup or adjustable image compression presets with live size savings.',
    category: 'Optimize PDF',
    iconName: 'Minimize2',
    primaryKeyword: 'compress pdf online free',
    secondaryKeywords: [
      'reduce pdf file size',
      'shrink pdf in browser',
      'pdf size reducer no upload',
    ],
    seoTitle: 'Compress PDF Online Free – Reduce PDF File Size | ToolMitra',
    seoDescription:
      'Shrink PDF file size locally in your browser without uploading documents. Choose lossless stream cleanup or image-based compression presets and download immediately.',
    supportedFormats: 'PDF (.pdf) · Standard unencrypted PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Processed privately in browser memory',
    howToSteps: [
      'Drop or select a PDF document from your device to view its page count and original size.',
      'Choose Lossless Structure to preserve selectable text, or Balanced, Strong, or Maximum for scanned/image-heavy PDFs.',
      'Click Compress PDF, compare the original vs. compressed size, and download your file.',
    ],
    faqs: [
      {
        question: 'Are my PDFs uploaded to external servers for compression?',
        answer:
          'No. ToolMitra compresses PDFs completely inside your browser memory without uploading or storing your documents.',
      },
      {
        question: 'What is the difference between Lossless Structure and Balanced/Strong modes?',
        answer:
          'Lossless Structure compacts internal PDF streams and optionally strips unused metadata while keeping selectable text and vectors intact. Balanced, Strong, and Maximum modes re-encode pages as compressed JPEG images, which produces larger size savings on scans and photo-heavy PDFs but turns page text into images.',
      },
      {
        question: 'Why did my already-small text PDF not shrink further?',
        answer:
          'Clean text-only PDFs are often already tightly compressed. If Lossless Structure yields minimal change, you can either keep your original file or test Balanced mode if visual pages are sufficient.',
      },
      {
        question: 'Can I compress password-protected PDFs?',
        answer:
          'Encrypted PDFs must be unlocked before they can be opened and re-compressed in the browser.',
      },
    ],
  },
  {
    id: 'repair-pdf',
    slug: 'repair-pdf',
    path: '/tools/repair-pdf',
    name: 'Repair PDF',
    shortDescription:
      'Recover readable pages from damaged PDF files with broken xref tables, trailing garbage bytes, or corrupted object headers locally.',
    category: 'Optimize PDF',
    iconName: 'Wrench',
    primaryKeyword: 'repair pdf online free',
    secondaryKeywords: [
      'fix corrupted pdf file',
      'recover broken pdf pages',
      'rebuild pdf xref table',
    ],
    seoTitle: 'Repair PDF Online – Recover Broken & Corrupted PDFs | ToolMitra',
    seoDescription:
      'Attempt client-side recovery of damaged PDFs by stripping leading junk bytes, tolerating malformed objects, and rebuilding clean xref streams.',
    supportedFormats: 'PDF (.pdf) · Damaged or partially truncated unencrypted PDFs',
    limitsSummary: 'Single file up to 50 MB · Client-side structural recovery via pdf-lib',
    howToSteps: [
      'Select or drop a damaged PDF file that fails to open normally or has header offset issues.',
      'ToolMitra scans for the %PDF- header, trims leading junk bytes, and copies intact pages into a fresh PDF.',
      'Review the recovery report and download the repaired PDF document.',
    ],
    faqs: [
      {
        question: 'What kinds of PDF corruption can Repair PDF fix?',
        answer:
          'It recovers files with leading garbage bytes before %PDF-, damaged cross-reference (xref) tables, or minor malformed non-page objects by rebuilding a clean PDF container.',
      },
      {
        question: 'Can severely truncated or zeroed-out PDF files always be recovered?',
        answer:
          'No tool can recreate missing binary page streams that were never downloaded or were overwritten, though intact pages inside partially damaged documents can often be rescued.',
      },
      {
        question: 'Are damaged files sent anywhere during repair?',
        answer:
          'No. Byte scanning and page reconstruction happen entirely inside browser memory.',
      },
    ],
  },
  {
    id: 'image-compressor',
    slug: 'image-compressor',
    path: '/tools/image-compressor',
    name: 'Image Compressor',
    shortDescription:
      'Reduce JPG, PNG, and WebP file sizes in your browser with adjustable quality and instant size comparison.',
    category: 'Optimize PDF',
    iconName: 'ImageDown',
    primaryKeyword: 'image compressor online',
    secondaryKeywords: ['compress jpg png webp', 'reduce image size', 'browser image optimizer'],
    seoTitle: 'Free Image Compressor – Reduce JPG, PNG & WebP Size | ToolMitra',
    seoDescription:
      'Compress JPG, PNG, and WebP images directly in your browser without uploading files. Adjust quality, compare file sizes, and download instantly.',
    supportedFormats: 'JPG, JPEG, PNG, WebP',
    limitsSummary: 'Up to 20 images per batch · Recommended max 25 MB per file · Processed locally in memory',
    howToSteps: [
      'Drop or select one or more JPG, PNG, or WebP images from your device.',
      'Choose your target quality slider and optional output format or max width.',
      'Review original vs. compressed sizes and download individual files or a single ZIP archive.',
    ],
    faqs: [
      {
        question: 'Are my images uploaded to a server?',
        answer:
          'No. Compression runs inside your browser using the HTML5 Canvas API, so your files never leave your device.',
      },
      {
        question: 'Which formats give the best size reduction?',
        answer:
          'Converting heavy PNG photos to WebP or JPG typically reduces file size significantly while preserving visual clarity.',
      },
      {
        question: 'Does compression affect transparency?',
        answer:
          'Transparency is preserved when outputting to PNG or WebP. JPG does not support transparent backgrounds.',
      },
    ],
  },

  // ===================== CONVERT PDF =====================
  {
    id: 'jpg-to-pdf',
    slug: 'jpg-to-pdf',
    path: '/tools/jpg-to-pdf',
    name: 'JPG to PDF Converter',
    shortDescription:
      'Combine one or more JPG or PNG images into a clean, print-ready PDF document with custom page sizing.',
    category: 'Convert PDF',
    iconName: 'FileImage',
    primaryKeyword: 'jpg to pdf converter',
    secondaryKeywords: ['convert images to pdf free', 'combine jpg into one pdf', 'jpeg to pdf'],
    seoTitle: 'JPG to PDF Converter – Merge Images to PDF | ToolMitra',
    seoDescription:
      'Convert JPG and PNG images into a single PDF in your browser. Reorder pages, choose A4 or Letter size, set margins, and download privately.',
    supportedFormats: 'JPG, JPEG, PNG, WebP',
    limitsSummary: 'Up to 30 images per PDF · Recommended max 20 MB per image · Processed locally',
    howToSteps: [
      'Add one or more JPG or PNG images and arrange them in the desired page order.',
      'Pick page size (A4, US Letter, or Fit to Image), orientation, and page margins.',
      'Generate and download your merged PDF file immediately.',
    ],
    faqs: [
      {
        question: 'Can I reorder pages before creating the PDF?',
        answer:
          'Yes. You can move images up or down in the queue before exporting the final PDF document.',
      },
      {
        question: 'Is there a watermark added to the PDF?',
        answer:
          'No. ToolMitra generates clean PDF documents with zero watermarks or branding stamps.',
      },
      {
        question: 'Are my documents stored anywhere?',
        answer:
          'No. The PDF is assembled strictly in browser memory and discarded when you close or clear the page.',
      },
    ],
  },
  {
    id: 'pdf-to-jpg',
    slug: 'pdf-to-jpg',
    path: '/tools/pdf-to-jpg',
    name: 'PDF to JPG',
    shortDescription:
      'Convert PDF pages into crisp JPG images in your browser with selectable resolution, quality control, page ranges, and ZIP export.',
    category: 'Convert PDF',
    iconName: 'Images',
    primaryKeyword: 'pdf to jpg converter free',
    secondaryKeywords: [
      'convert pdf pages to jpeg',
      'save pdf as jpg images',
      'extract pdf pages as jpg',
    ],
    seoTitle: 'PDF to JPG Converter Free – Save PDF Pages as Images | ToolMitra',
    seoDescription:
      'Convert PDF pages to high-resolution JPG images directly in your browser. Choose 1×–3× resolution, adjust JPG quality, pick page ranges, and download individually or as a ZIP.',
    supportedFormats: 'Input: PDF (.pdf) · Output: JPG (.jpg) or ZIP archive',
    limitsSummary: 'Single PDF up to 50 MB · Local canvas rendering with white page background',
    howToSteps: [
      'Select or drag and drop a PDF file from your device.',
      'Choose image resolution (1×, 2×, or 3×), JPG quality, and whether to export all pages or specific ranges.',
      'Click Convert to JPG and download individual images or all pages in a single ZIP archive.',
    ],
    faqs: [
      {
        question: 'How does ToolMitra convert PDF pages to JPG without uploading files?',
        answer:
          'Pages are rendered onto an offscreen HTML5 Canvas inside your browser using PDF.js and exported as JPG blobs locally on your device.',
      },
      {
        question: 'Which resolution preset should I pick?',
        answer:
          'High (2×) offers sharp readability for documents, slides, and invoices at reasonable file sizes. Use Standard (1×) for quick previews or Print Detail (3×) for high-resolution graphics.',
      },
      {
        question: 'Can I convert only specific pages from a large PDF?',
        answer:
          'Yes. Switch "Pages to Export" to Custom Page Range and enter ranges such as 1-3, 5, 8-10.',
      },
      {
        question: 'Why do transparent PDF backgrounds appear white in JPG output?',
        answer:
          'JPG images do not support transparency, so ToolMitra paints a clean white sheet behind each rendered PDF page to prevent dark or black backgrounds.',
      },
    ],
  },
  {
    id: 'scan-to-pdf',
    slug: 'scan-to-pdf',
    path: '/tools/scan-to-pdf',
    name: 'Scan to PDF',
    shortDescription:
      'Capture document photos via camera or upload images, apply crisp B&W paper enhancement filters, rotate, and save as a clean PDF.',
    category: 'Convert PDF',
    iconName: 'ScanLine',
    primaryKeyword: 'scan to pdf online free',
    secondaryKeywords: [
      'photo to scanned pdf',
      'document scanner in browser',
      'camera scan to pdf',
    ],
    seoTitle: 'Scan to PDF – Camera & Photo Document Enhancer | ToolMitra',
    seoDescription:
      'Turn receipts, notes, and forms into crisp scanned PDFs in your browser. Capture via camera or upload photos, apply Document B&W filters, rotate, and download.',
    supportedFormats: 'JPG, PNG, WebP or live device camera · Output: PDF (.pdf)',
    limitsSummary: 'Up to 30 document photos (20 MB each) · Local canvas filtering',
    howToSteps: [
      'Upload document photos or click Capture via Camera to snap pages directly.',
      'Choose a scan filter (Document B&W, Grayscale, Color Contrast, or Original), rotate sideways shots, and set order.',
      'Click Create Scanned PDF to download an A4, Letter, or aspect-fitted PDF.',
    ],
    faqs: [
      {
        question: 'What does the Document B&W scan filter do?',
        answer:
          'It converts uneven phone lighting into high-contrast black text on a bright white background so printed forms and handwritten notes look like flatbed scans.',
      },
      {
        question: 'Does Scan to PDF work on mobile phones?',
        answer:
          'Yes. Tap Capture via Camera to use your rear camera directly inside the browser or pick photos from your gallery.',
      },
      {
        question: 'Are scanned documents uploaded to any cloud storage?',
        answer:
          'No. Image enhancement and PDF assembly run strictly in browser memory.',
      },
    ],
  },
  {
    id: 'html-to-pdf',
    slug: 'html-to-pdf',
    path: '/tools/html-to-pdf',
    name: 'HTML to PDF',
    shortDescription:
      'Convert sanitized HTML markup—headings, paragraphs, lists, quotes, code blocks, and tables—into a multi-page vector PDF in your browser.',
    category: 'Convert PDF',
    iconName: 'FileCode2',
    primaryKeyword: 'html to pdf converter browser',
    secondaryKeywords: [
      'convert html file to pdf',
      'render html markup to pdf',
      'client side html to pdf',
    ],
    seoTitle: 'HTML to PDF Converter – Safe Client-Side PDF Export | ToolMitra',
    seoDescription:
      'Paste HTML or upload an .html file, inspect a sandboxed live preview, configure A4/Letter page size and margins, and export a clean vector PDF locally.',
    supportedFormats: 'Input: HTML markup or .html file · Output: Vector PDF (.pdf)',
    limitsSummary: 'Up to 250,000 HTML characters · Scripts automatically stripped for safety',
    howToSteps: [
      'Paste semantic HTML or load an .html file into the editor and review the sandboxed preview.',
      'Pick A4 or US Letter, Portrait or Landscape orientation, page margins, and body font size.',
      'Click Convert HTML to PDF and download your formatted multi-page PDF.',
    ],
    faqs: [
      {
        question: 'How does ToolMitra handle scripts or unsafe tags in uploaded HTML?',
        answer:
          'Before previewing or converting, ToolMitra strips <script>, <iframe>, event attributes, and javascript: links, and isolates the preview inside a sandboxed frame.',
      },
      {
        question: 'Which HTML tags render best in the output PDF?',
        answer:
          'Semantic elements including headings (h1–h4), paragraphs (p), ordered/unordered lists (ol, ul, li), blockquotes, code blocks (pre), horizontal rules (hr), and tables (table, tr, th, td) convert cleanly into vector PDF blocks.',
      },
      {
        question: 'Are external stylesheets or remote images fetched during export?',
        answer:
          'No. To preserve zero-upload privacy and deterministic browser execution, external network assets are not fetched; built-in typography styles your document locally.',
      },
    ],
  },
  {
    id: 'pdf-to-markdown',
    slug: 'pdf-to-markdown',
    path: '/tools/pdf-to-markdown',
    name: 'PDF to Markdown',
    shortDescription:
      'Extract text from PDF documents into clean Markdown (.md) with automatic heading detection, list formatting, copy, and download.',
    category: 'Convert PDF',
    iconName: 'FileSpreadsheet',
    primaryKeyword: 'pdf to markdown converter',
    secondaryKeywords: [
      'extract markdown from pdf',
      'convert pdf text to md',
      'pdf to md online free',
    ],
    seoTitle: 'PDF to Markdown Converter – Extract Clean .md Files | ToolMitra',
    seoDescription:
      'Convert selectable text inside PDF documents to structured Markdown (.md) in your browser. Infers headings, bullet lists, and page breaks privately.',
    supportedFormats: 'Input: PDF with selectable text (.pdf) · Output: Markdown (.md)',
    limitsSummary: 'Single PDF up to 50 MB · Browser text extraction via PDF.js',
    howToSteps: [
      'Drop or select a text-based PDF document from your device.',
      'Toggle heading inference or page separator markers (---) as needed.',
      'Copy the generated Markdown directly or download it as a .md file.',
    ],
    faqs: [
      {
        question: 'How are Markdown headings detected?',
        answer:
          'ToolMitra calculates the median body font height across the document and promotes noticeably larger short lines to # and ## Markdown headings.',
      },
      {
        question: 'What if my PDF is a scanned image with no selectable text?',
        answer:
          'Scanned image PDFs have no embedded text layer. Run OCR PDF first to recognize text, then convert or export.',
      },
      {
        question: 'Do multi-column PDFs or complex tables convert cleanly?',
        answer:
          'Simple single-column documents and lists convert cleanly; complex multi-column magazine layouts or merged tables may need minor manual Markdown cleanup.',
      },
    ],
  },

  // ===================== EDIT PDF =====================
  {
    id: 'edit-pdf',
    slug: 'edit-pdf',
    path: '/tools/edit-pdf',
    name: 'Edit PDF',
    shortDescription:
      'Add text notes, transparent text highlights, and rectangular callout boxes anywhere on your PDF pages with interactive preview placement.',
    category: 'Edit PDF',
    iconName: 'FilePenLine',
    primaryKeyword: 'edit pdf online free',
    secondaryKeywords: [
      'add text to pdf',
      'highlight pdf in browser',
      'annotate pdf without upload',
    ],
    seoTitle: 'Edit PDF Online Free – Add Text, Highlights & Callouts | ToolMitra',
    seoDescription:
      'Click to add text notes, semi-transparent highlights, and callout boxes directly onto PDF pages in your browser with live page preview and instant download.',
    supportedFormats: 'PDF (.pdf) · Unencrypted single PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Overlay text, highlight & box annotations',
    howToSteps: [
      'Upload a PDF file to view interactive page previews.',
      'Choose Add Text, Highlight, or Shape Box, click on the page to set coordinates, and click Add to Page.',
      'Review your annotation list across pages and click Save Edited PDF.',
    ],
    faqs: [
      {
        question: 'Can I add annotations to multiple pages before downloading?',
        answer:
          'Yes. Switch pages using Prev/Next, add as many text notes, highlights, or boxes as needed, and export all changes together.',
      },
      {
        question: 'Can Edit PDF erase existing confidential text permanently?',
        answer:
          'Shape boxes are visual overlays; existing PDF text streams remain underneath. For irreversible removal of sensitive content, use Redact PDF.',
      },
      {
        question: 'Are edited PDFs stored on ToolMitra servers?',
        answer:
          'No. Every annotation is drawn locally inside your browser using pdf-lib.',
      },
    ],
  },
  {
    id: 'watermark-pdf',
    slug: 'watermark-pdf',
    path: '/tools/watermark-pdf',
    name: 'Watermark PDF',
    shortDescription:
      'Stamp custom text or PNG/JPG logo watermarks diagonally, centered, corner-aligned, or tiled across your PDF pages with live preview.',
    category: 'Edit PDF',
    iconName: 'Stamp',
    primaryKeyword: 'watermark pdf online free',
    secondaryKeywords: [
      'add confidential stamp to pdf',
      'add logo watermark to pdf',
      'pdf watermark browser',
    ],
    seoTitle: 'Watermark PDF Online – Text & Logo Stamps Privately | ToolMitra',
    seoDescription:
      'Add diagonal, tiled, or corner text and PNG/JPG logo watermarks to PDF documents inside your browser. Adjust opacity, color, font size, and page ranges.',
    supportedFormats: 'Input: PDF (.pdf) + optional PNG/JPG logo · Output: PDF (.pdf)',
    limitsSummary: 'Single PDF up to 50 MB · Client-side vector text or image stamping',
    howToSteps: [
      'Drop or select your PDF file to view the live watermark preview.',
      'Enter custom watermark text or upload a PNG/JPG logo and pick Diagonal, Tiled, Center, or Corner placement.',
      'Adjust opacity, color, and page ranges, then click Apply Watermark & Download.',
    ],
    faqs: [
      {
        question: 'Can I stamp a company logo PNG instead of text?',
        answer:
          'Yes. Switch the watermark type to Image / Logo and upload a PNG or JPG graphic with adjustable opacity.',
      },
      {
        question: 'Can I skip the cover page when watermarking?',
        answer:
          'Yes. Select Custom Range under Pages to Watermark (for example 2-10) to skip the title page.',
      },
      {
        question: 'Does ToolMitra add its own branding alongside my watermark?',
        answer:
          'No. Only the watermark text or logo you specify is applied.',
      },
    ],
  },
  {
    id: 'page-numbers',
    slug: 'page-numbers',
    path: '/tools/page-numbers',
    name: 'Page Numbers',
    shortDescription:
      'Insert clean header or footer page numbers ("1", "1 / N", "1 of N", or "Page 1 of N") with cover-page skipping and custom styling.',
    category: 'Edit PDF',
    iconName: 'Hash',
    primaryKeyword: 'add page numbers to pdf',
    secondaryKeywords: [
      'number pdf pages online',
      'insert pdf footer page numbers',
      'bates style pdf pagination',
    ],
    seoTitle: 'Add Page Numbers to PDF – Custom Positions & Formats | ToolMitra',
    seoDescription:
      'Add page numbers to PDF headers or footers in your browser. Choose position, format (1 of N, Page X of Y), starting page, color, and font size privately.',
    supportedFormats: 'PDF (.pdf) · Standard unencrypted PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Clean vector Helvetica text stamps',
    howToSteps: [
      'Upload your PDF document to check page count and live margin preview.',
      'Pick placement (bottom/top left, center, right), number format, font size, and starting page.',
      'Click Add Page Numbers and download the paginated PDF.',
    ],
    faqs: [
      {
        question: 'How do I skip numbering the cover page?',
        answer:
          'Set "Start Numbering On PDF Page" to 2 (and Starting Number Value to 1) so the cover page remains unnumbered.',
      },
      {
        question: 'Which numbering formats are supported?',
        answer:
          'You can format numbers as "1", "1 / 12", "1 of 12", or "Page 1 of 12".',
      },
      {
        question: 'Does adding page numbers degrade existing text or images?',
        answer:
          'No. Numbers are written directly as crisp PDF vector text without altering existing page content.',
      },
    ],
  },
  {
    id: 'pdf-forms',
    slug: 'pdf-forms',
    path: '/tools/pdf-forms',
    name: 'PDF Forms',
    shortDescription:
      'Inspect, fill out, and optionally flatten interactive PDF AcroForm fields (text inputs, checkboxes, radio groups, and dropdowns) locally.',
    category: 'Edit PDF',
    iconName: 'ClipboardList',
    primaryKeyword: 'fill pdf forms online free',
    secondaryKeywords: [
      'pdf acroform filler',
      'flatten fillable pdf form',
      'edit pdf form fields browser',
    ],
    seoTitle: 'Fill PDF Forms Online Free – AcroForm Editor & Flattener | ToolMitra',
    seoDescription:
      'Open interactive AcroForm PDFs in your browser, fill text inputs, checkboxes, radio buttons, and dropdowns, and optionally flatten fields before downloading.',
    supportedFormats: 'PDF (.pdf) with standard AcroForm fields',
    limitsSummary: 'Single PDF up to 50 MB · Supports AcroForm (not proprietary XFA forms)',
    howToSteps: [
      'Upload a fillable AcroForm PDF to scan all embedded form fields automatically.',
      'Fill or update text fields, checkboxes, radio choices, and dropdown selections.',
      'Optionally check Flatten fields to lock answers into static text, then download.',
    ],
    faqs: [
      {
        question: 'What happens if my PDF form has no interactive AcroForm fields?',
        answer:
          'Flat scanned forms without AcroForm fields are clearly detected; use Edit PDF to type answers directly onto flat pages.',
      },
      {
        question: 'Why would I flatten a filled PDF form?',
        answer:
          'Flattening bakes form values directly into the page content stream so recipients cannot accidentally edit answers or see missing field borders.',
      },
      {
        question: 'Are proprietary dynamic XFA forms supported?',
        answer:
          'No. Standard ISO PDF AcroForms are supported in the browser; legacy Adobe XFA forms require desktop conversion first.',
      },
    ],
  },

  // ===================== PDF SECURITY =====================
  {
    id: 'sign-pdf',
    slug: 'sign-pdf',
    path: '/tools/sign-pdf',
    name: 'Sign PDF',
    shortDescription:
      'Draw, type, or upload your visual signature, click on the page preview to position it, and save your signed PDF locally.',
    category: 'PDF Security',
    iconName: 'PenTool',
    primaryKeyword: 'sign pdf online free',
    secondaryKeywords: [
      'add signature to pdf',
      'electronic signature pdf browser',
      'draw signature on pdf',
    ],
    seoTitle: 'Sign PDF Online Free – Draw or Type Electronic Signature | ToolMitra',
    seoDescription:
      'Create a handwritten, typed, or uploaded signature in your browser, position it directly on your PDF preview, and download the signed PDF with zero uploads.',
    supportedFormats: 'Input: PDF (.pdf) + optional PNG/JPG signature · Output: PDF (.pdf)',
    limitsSummary: 'Single PDF up to 50 MB · Visual electronic signature placement',
    howToSteps: [
      'Upload the PDF document you want to sign.',
      'Draw your signature with mouse or touch, type your name, or upload a transparent PNG signature.',
      'Click the page preview to position your signature, pick target pages, and download the signed PDF.',
    ],
    faqs: [
      {
        question: 'Is this a visual electronic signature or a cryptographic PKCS#12 certificate?',
        answer:
          'ToolMitra embeds a visual electronic signature graphic (drawn, typed, or PNG/JPG) onto your PDF pages. It does not issue CA-backed cryptographic PKCS#12 digital signatures.',
      },
      {
        question: 'Can I sign only the last page or multiple pages?',
        answer:
          'Yes. You can place your signature on the currently previewed page, all pages, or a custom page range.',
      },
      {
        question: 'Is my signature image saved on any server?',
        answer:
          'No. Your drawn canvas strokes and signed document never leave your device.',
      },
    ],
  },
  {
    id: 'redact-pdf',
    slug: 'redact-pdf',
    path: '/tools/redact-pdf',
    name: 'Redact PDF',
    shortDescription:
      'Permanently black out sensitive phrases or regions on PDF pages and flatten redacted pages into pixels so hidden text cannot be copied.',
    category: 'PDF Security',
    iconName: 'EyeOff',
    primaryKeyword: 'redact pdf online free',
    secondaryKeywords: [
      'permanently remove text from pdf',
      'black out sensitive pdf info',
      'true pdf redaction browser',
    ],
    seoTitle: 'Redact PDF Online – Permanently Black Out Sensitive Info | ToolMitra',
    seoDescription:
      'Search and mark confidential text or draw redaction boxes on PDF pages. Redacted pages are permanently flattened to images and metadata stripped locally.',
    supportedFormats: 'PDF (.pdf) · Standard unencrypted PDF documents',
    limitsSummary: 'Single PDF up to 50 MB · Irreversible raster page flattening',
    howToSteps: [
      'Upload your PDF document to preview pages and search text.',
      'Enter sensitive words or phrases to auto-mark matches, or click the preview to place manual black boxes.',
      'Click Apply Permanent Redactions to flatten redacted pages and strip document metadata.',
    ],
    faqs: [
      {
        question: 'Why does true redaction flatten pages instead of just drawing a black rectangle?',
        answer:
          'Drawing a vector rectangle leaves the underlying text selectable in the PDF file. Flattening redacted pages into a bitmap after painting opaque black regions destroys the underlying text permanently.',
      },
      {
        question: 'Are pages without redactions still crisp vector PDFs?',
        answer:
          'Yes. Un-redacted pages are copied losslessly while only the pages containing redactions are flattened, plus document metadata (title/author) is cleared.',
      },
      {
        question: 'Should I double-check the output PDF before sharing externally?',
        answer:
          'Always verify the downloaded PDF visually and test selecting around redacted boxes to confirm every sensitive detail—including scanned headers or logos—was marked.',
      },
    ],
  },

  // ===================== PDF INTELLIGENCE =====================
  {
    id: 'ocr-pdf',
    slug: 'ocr-pdf',
    path: '/tools/ocr-pdf',
    name: 'OCR PDF',
    shortDescription:
      'Recognize text inside scanned PDF pages locally using Tesseract WebAssembly—copy plain text or download a searchable PDF.',
    category: 'PDF Intelligence',
    iconName: 'ScanText',
    primaryKeyword: 'ocr pdf online free',
    secondaryKeywords: [
      'make scanned pdf searchable',
      'extract text from scanned pdf',
      'tesseract pdf ocr browser',
    ],
    seoTitle: 'OCR PDF Online Free – Make Scanned PDFs Searchable | ToolMitra',
    seoDescription:
      'Run browser-based optical character recognition (OCR) on scanned PDFs without uploading documents. Extract plain text (.txt) or build a searchable PDF locally.',
    supportedFormats: 'Input: PDF (.pdf) · Output: Text (.txt) + Searchable PDF (.pdf)',
    limitsSummary: 'Up to 25 pages per run · 35 MB max · Downloads ~4 MB language pack on first use',
    howToSteps: [
      'Upload a scanned PDF document and pick your document language (English, Hindi, Spanish, French, or German).',
      'Select all pages (up to 25) or enter a custom page range, then click Recognize Text (OCR).',
      'Copy extracted text, save .txt, or download a Searchable PDF with an embedded invisible text layer.',
    ],
    faqs: [
      {
        question: 'Does OCR PDF send my scanned pages to a cloud AI server?',
        answer:
          'No. Recognition runs inside your browser via Tesseract.js WebAssembly. Your scanned pages remain in device memory; only the open-source language model file (~4 MB) downloads once from the Tesseract CDN.',
      },
      {
        question: 'How does the Searchable PDF output work?',
        answer:
          'ToolMitra embeds recognized text lines at matched positions with 0% opacity on each page so PDF readers can search and highlight text while preserving the original scan visuals.',
      },
      {
        question: 'Why is there a 25-page limit per OCR run?',
        answer:
          'Rendering high-DPI page canvases and running WebAssembly OCR is CPU-intensive; batching up to 25 pages at a time keeps browser tabs responsive.',
      },
    ],
  },
  {
    id: 'compare-pdf',
    slug: 'compare-pdf',
    path: '/tools/compare-pdf',
    name: 'Compare PDF',
    shortDescription:
      'Compare two PDF versions side by side with line-by-line text diffs, visual pixel-change heatmaps, and a downloadable Markdown diff report.',
    category: 'PDF Intelligence',
    iconName: 'GitCompare',
    primaryKeyword: 'compare pdf files online',
    secondaryKeywords: [
      'pdf diff checker',
      'find differences between two pdfs',
      'visual pdf comparison browser',
    ],
    seoTitle: 'Compare PDF Online Free – Text Diff & Visual Heatmap | ToolMitra',
    seoDescription:
      'Spot changes between two PDF drafts in your browser. Inspect added/removed text lines, view pixel-difference heatmaps per page, and export a diff report.',
    supportedFormats: 'Input: Two unencrypted PDFs (.pdf) · Output: Diff summary (.md)',
    limitsSummary: 'Up to 50 MB per PDF · Line-by-line LCS diff & canvas pixel comparison',
    howToSteps: [
      'Upload the Original (A) PDF and the Revised (B) PDF.',
      'Click Compare Documents to analyze text differences and visual pixel shifts across pages.',
      'Step through pages to inspect line diffs and red pixel-change highlights, or download the Markdown report.',
    ],
    faqs: [
      {
        question: 'What does the Visual Pixel Diff Heatmap show?',
        answer:
          'It compares rendered pixels between Page N of Document A and Document B, highlighting altered layout, typography, images, or numbers in crimson red.',
      },
      {
        question: 'What if both PDFs are scanned images without selectable text?',
        answer:
          'Even when selectable text lines are empty on scanned documents, the visual pixel diff heatmap still highlights visual edits across pages.',
      },
      {
        question: 'Can I save a list of all text changes?',
        answer:
          'Yes. Click Download Diff Report (.md) to save a page-by-page summary of added and removed text lines.',
      },
    ],
  },

  // ===================== GENERATORS =====================
  {
    id: 'qr-code-generator',
    slug: 'qr-code-generator',
    path: '/tools/qr-code-generator',
    name: 'QR Code Generator',
    shortDescription:
      'Create scannable QR codes for URLs, UPI payments (INR), plain text, Wi-Fi networks, email, or phone links in PNG and SVG.',
    category: 'Generators',
    iconName: 'QrCode',
    primaryKeyword: 'qr code generator',
    secondaryKeywords: [
      'upi payment qr generator',
      'free custom qr code maker',
      'download qr code svg png',
      'wifi qr generator',
    ],
    seoTitle: 'Free QR Code & UPI Payment QR Generator – PNG & SVG | ToolMitra',
    seoDescription:
      'Create custom QR codes for URLs, UPI payments in INR, Wi-Fi, text, and email in your browser. Preview live, copy UPI links, and export PNG or SVG.',
    supportedFormats: 'Exports crisp PNG (raster) and SVG (vector) · Supports upi://pay INR links',
    limitsSummary: 'Up to 2,000 characters depending on error correction level · Instant client rendering',
    howToSteps: [
      'Choose a mode such as URL, UPI Payment, Text, Wi-Fi, Email, or Phone and enter your details.',
      'For UPI QR codes, enter your UPI ID and payee name—leave amount blank for open-amount payments or set a fixed INR amount.',
      'Check live scan contrast and download the QR code as PNG for digital sharing or SVG for crisp printing.',
    ],
    faqs: [
      {
        question: 'Do QR codes generated here expire?',
        answer:
          'No. ToolMitra creates static QR codes that encode your URL, text, or UPI payment URI directly—they never expire or rely on a tracking redirect.',
      },
      {
        question: 'How does the UPI Payment QR mode work?',
        answer:
          'It encodes your UPI ID, payee name, currency (INR), and optional amount or note into a standard upi://pay URI in your browser. Scanning opens a compatible UPI app so the payer can verify details and enter their PIN inside their own app.',
      },
      {
        question: 'Is it safe to generate a UPI QR code without entering a PIN or OTP?',
        answer:
          'Yes. Receiving payments via a UPI QR code only requires your public UPI ID (VPA) and payee name. Never share your UPI PIN, OTP, card details, or banking password on any website.',
      },
      {
        question: 'Can I create a UPI QR code without a fixed payment amount?',
        answer:
          'Yes. Leave the Amount field blank to generate an open-amount UPI QR code, allowing the person scanning to type the payment amount inside their UPI app.',
      },
      {
        question: 'Should I download PNG or SVG?',
        answer:
          'Use PNG for websites, invoices, and messaging apps, or SVG when printing shop standees, posters, and packaging at any size without pixelation.',
      },
      {
        question: 'What does error correction level mean?',
        answer:
          'Higher levels (Q or H) add redundancy so the QR code remains scannable even if partially smudged or covered.',
      },
    ],
  },

  // ===================== TEXT & WRITING =====================
  {
    id: 'word-counter',
    slug: 'word-counter',
    path: '/tools/word-counter',
    name: 'Word Counter',
    shortDescription:
      'Count words, characters, sentences, paragraphs, reading time, and top keyword density as you type.',
    category: 'Text & Writing',
    iconName: 'FileText',
    primaryKeyword: 'word counter',
    secondaryKeywords: ['character counter online', 'sentence and reading time counter', 'text analyzer'],
    seoTitle: 'Word Counter & Character Counter Online | ToolMitra',
    seoDescription:
      'Count words, characters, sentences, and paragraphs in real time. Check estimated reading time, keyword frequency, and text case tools privately.',
    supportedFormats: 'Plain text input & .txt file import',
    limitsSummary: 'Supports large documents up to 500,000 characters smoothly in the browser',
    howToSteps: [
      'Paste or type your draft into the editor, or load a local .txt file.',
      'Monitor live word, character (with/without spaces), sentence, and paragraph metrics.',
      'Inspect reading/speaking time, keyword density, or apply quick text cleanup actions.',
    ],
    faqs: [
      {
        question: 'How is reading time calculated?',
        answer:
          'Reading time uses an average adult silent reading speed of 225 words per minute, and speaking time uses 130 words per minute.',
      },
      {
        question: 'Is my pasted text saved or sent anywhere?',
        answer:
          'No. All text analysis runs locally in your browser memory without transmitting content over the network.',
      },
      {
        question: 'How are words counted with hyphenated terms?',
        answer:
          'Words are tokenized on whitespace boundaries after trimming extra spaces, matching standard document editor conventions.',
      },
    ],
  },

  // ===================== CALCULATORS =====================
  {
    id: 'age-calculator',
    slug: 'age-calculator',
    path: '/tools/age-calculator',
    name: 'Age Calculator',
    shortDescription:
      'Find your exact age in years, months, days, and hours with next birthday countdown and custom target dates.',
    category: 'Calculators',
    iconName: 'CalendarClock',
    primaryKeyword: 'age calculator',
    secondaryKeywords: ['calculate exact age from dob', 'age in years months days', 'birthday countdown'],
    seoTitle: 'Age Calculator – Exact Age by Date of Birth | ToolMitra',
    seoDescription:
      'Calculate your exact age in years, months, days, and hours from your date of birth, plus your next birthday countdown and custom date comparisons.',
    supportedFormats: 'Gregorian calendar dates (YYYY-MM-DD)',
    limitsSummary: 'Handles leap years and varying month lengths accurately from year 1900 onward',
    howToSteps: [
      'Enter your Date of Birth using the date selector.',
      'Optionally adjust the "Calculate Age As Of" date to check age on a past or future date.',
      'View your exact breakdown in years, months, days, total weeks, and next birthday countdown.',
    ],
    faqs: [
      {
        question: 'How does the calculator handle leap years and 28/30/31-day months?',
        answer:
          'Calendar arithmetic accounts for exact month lengths and leap years (including February 29) rather than dividing by 365.25.',
      },
      {
        question: 'Can I calculate age for a future or past target date?',
        answer:
          'Yes. Change the target "Age As Of" date to calculate exact age for school admissions, retirement milestones, or historical dates.',
      },
      {
        question: 'What happens if the birth date is after the target date?',
        answer:
          'The tool displays a clear validation message explaining that the date of birth cannot be later than the target date.',
      },
    ],
  },
];

export function getToolBySlug(slug: string | undefined): ToolDefinition | undefined {
  if (!slug) return undefined;
  return TOOLS.find((tool) => tool.slug === slug);
}
