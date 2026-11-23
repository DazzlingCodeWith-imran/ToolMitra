export type ToolCategory = 'Image & PDF' | 'Generators' | 'Text & Writing' | 'Calculators';

export type ToolIconName =
  | 'ImageDown'
  | 'FileImage'
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
  'Image & PDF',
  'Generators',
  'Text & Writing',
  'Calculators',
];

export const TOOLS: ToolDefinition[] = [
  {
    id: 'image-compressor',
    slug: 'image-compressor',
    path: '/tools/image-compressor',
    name: 'Image Compressor',
    shortDescription:
      'Reduce JPG, PNG, and WebP file sizes in your browser with adjustable quality and instant size comparison.',
    category: 'Image & PDF',
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
  {
    id: 'jpg-to-pdf',
    slug: 'jpg-to-pdf',
    path: '/tools/jpg-to-pdf',
    name: 'JPG to PDF Converter',
    shortDescription:
      'Combine one or more JPG or PNG images into a clean, print-ready PDF document with custom page sizing.',
    category: 'Image & PDF',
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
    id: 'qr-code-generator',
    slug: 'qr-code-generator',
    path: '/tools/qr-code-generator',
    name: 'QR Code Generator',
    shortDescription:
      'Create scannable QR codes for URLs, plain text, Wi-Fi networks, email, or phone links in PNG and SVG.',
    category: 'Generators',
    iconName: 'QrCode',
    primaryKeyword: 'qr code generator',
    secondaryKeywords: ['free custom qr code maker', 'download qr code svg png', 'wifi qr generator'],
    seoTitle: 'Free QR Code Generator – PNG & SVG Export | ToolMitra',
    seoDescription:
      'Create custom QR codes for URLs, text, Wi-Fi, and email in seconds. Customize colors and error correction, then export as crisp PNG or SVG.',
    supportedFormats: 'Exports crisp PNG (raster) and SVG (vector)',
    limitsSummary: 'Up to 2,000 characters depending on error correction level · Instant client rendering',
    howToSteps: [
      'Select a content type such as Website URL, Plain Text, Wi-Fi, Email, or Phone.',
      'Customize foreground/background colors, output size, and error correction level.',
      'Preview scan contrast and download as PNG for web or SVG for print.',
    ],
    faqs: [
      {
        question: 'Do QR codes generated here expire?',
        answer:
          'No. ToolMitra creates static QR codes that encode your data directly—they never expire or rely on a tracking redirect.',
      },
      {
        question: 'Should I download PNG or SVG?',
        answer:
          'Use PNG for digital sharing and documents, or SVG when printing flyers, signage, and packaging at any scale.',
      },
      {
        question: 'What does error correction level mean?',
        answer:
          'Higher levels (Q or H) add redundancy so the QR code remains scannable even if partially smudged or covered.',
      },
    ],
  },
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
