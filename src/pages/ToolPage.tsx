import { useParams } from 'react-router-dom';
import { AgeCalculatorTool } from '@/src/components/tools/AgeCalculatorTool';
import { ImageCompressorTool } from '@/src/components/tools/ImageCompressorTool';
import { JpgToPdfTool } from '@/src/components/tools/JpgToPdfTool';
import { QrCodeGeneratorTool } from '@/src/components/tools/QrCodeGeneratorTool';
import { ToolPageLayout } from '@/src/components/tools/ToolPageLayout';
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
    case 'image-compressor':
      toolWorkspace = <ImageCompressorTool />;
      break;
    case 'jpg-to-pdf':
      toolWorkspace = <JpgToPdfTool />;
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
