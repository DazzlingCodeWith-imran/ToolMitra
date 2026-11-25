import { useParams } from 'react-router-dom';
import { AgeCalculatorTool } from '@/src/components/tools/AgeCalculatorTool';
import { ComparePdfTool } from '@/src/components/tools/ComparePdfTool';
import { CompressPdfTool } from '@/src/components/tools/CompressPdfTool';
import { CropPdfTool } from '@/src/components/tools/CropPdfTool';
import { EditPdfTool } from '@/src/components/tools/EditPdfTool';
import { HtmlToPdfTool } from '@/src/components/tools/HtmlToPdfTool';
import { ImageCompressorTool } from '@/src/components/tools/ImageCompressorTool';
import { JpgToPdfTool } from '@/src/components/tools/JpgToPdfTool';
import { MergePdfTool } from '@/src/components/tools/MergePdfTool';
import { OcrPdfTool } from '@/src/components/tools/OcrPdfTool';
import { OrganizePdfTool } from '@/src/components/tools/OrganizePdfTool';
import { PageNumbersTool } from '@/src/components/tools/PageNumbersTool';
import { PdfFormsTool } from '@/src/components/tools/PdfFormsTool';
import { PdfToJpgTool } from '@/src/components/tools/PdfToJpgTool';
import { PdfToMarkdownTool } from '@/src/components/tools/PdfToMarkdownTool';
import { PdfWorkflowTool } from '@/src/components/tools/PdfWorkflowTool';
import { QrCodeGeneratorTool } from '@/src/components/tools/QrCodeGeneratorTool';
import { RedactPdfTool } from '@/src/components/tools/RedactPdfTool';
import { RepairPdfTool } from '@/src/components/tools/RepairPdfTool';
import { RotatePdfTool } from '@/src/components/tools/RotatePdfTool';
import { ScanToPdfTool } from '@/src/components/tools/ScanToPdfTool';
import { SignPdfTool } from '@/src/components/tools/SignPdfTool';
import { SplitPdfTool } from '@/src/components/tools/SplitPdfTool';
import { ToolPageLayout } from '@/src/components/tools/ToolPageLayout';
import { WatermarkPdfTool } from '@/src/components/tools/WatermarkPdfTool';
import { WordCounterTool } from '@/src/components/tools/WordCounterTool';
import { getToolBySlug } from '@/src/data/tools';
import { NotFoundPage } from './NotFoundPage';

export function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const tool = getToolBySlug(slug);

  if (!tool) {
    return <NotFoundPage />;
  }

  let toolWorkspace = null;
  switch (tool.id) {
    case 'pdf-workflow':
      toolWorkspace = <PdfWorkflowTool />;
      break;
    case 'merge-pdf':
      toolWorkspace = <MergePdfTool />;
      break;
    case 'split-pdf':
      toolWorkspace = <SplitPdfTool />;
      break;
    case 'organize-pdf':
      toolWorkspace = <OrganizePdfTool />;
      break;
    case 'rotate-pdf':
      toolWorkspace = <RotatePdfTool />;
      break;
    case 'crop-pdf':
      toolWorkspace = <CropPdfTool />;
      break;
    case 'compress-pdf':
      toolWorkspace = <CompressPdfTool />;
      break;
    case 'repair-pdf':
      toolWorkspace = <RepairPdfTool />;
      break;
    case 'image-compressor':
      toolWorkspace = <ImageCompressorTool />;
      break;
    case 'jpg-to-pdf':
      toolWorkspace = <JpgToPdfTool />;
      break;
    case 'pdf-to-jpg':
      toolWorkspace = <PdfToJpgTool />;
      break;
    case 'scan-to-pdf':
      toolWorkspace = <ScanToPdfTool />;
      break;
    case 'html-to-pdf':
      toolWorkspace = <HtmlToPdfTool />;
      break;
    case 'pdf-to-markdown':
      toolWorkspace = <PdfToMarkdownTool />;
      break;
    case 'edit-pdf':
      toolWorkspace = <EditPdfTool />;
      break;
    case 'watermark-pdf':
      toolWorkspace = <WatermarkPdfTool />;
      break;
    case 'page-numbers':
      toolWorkspace = <PageNumbersTool />;
      break;
    case 'pdf-forms':
      toolWorkspace = <PdfFormsTool />;
      break;
    case 'sign-pdf':
      toolWorkspace = <SignPdfTool />;
      break;
    case 'redact-pdf':
      toolWorkspace = <RedactPdfTool />;
      break;
    case 'ocr-pdf':
      toolWorkspace = <OcrPdfTool />;
      break;
    case 'compare-pdf':
      toolWorkspace = <ComparePdfTool />;
      break;
    case 'qr-code-generator':
      toolWorkspace = <QrCodeGeneratorTool />;
      break;
    case 'word-counter':
      toolWorkspace = <WordCounterTool />;
      break;
    case 'age-calculator':
      toolWorkspace = <AgeCalculatorTool />;
      break;
    default:
      return <NotFoundPage />;
  }

  return <ToolPageLayout tool={tool}>{toolWorkspace}</ToolPageLayout>;
}
