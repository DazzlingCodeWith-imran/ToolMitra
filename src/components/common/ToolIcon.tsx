import { CalendarClock, FileImage, FileText, ImageDown, QrCode } from 'lucide-react';
import type { ToolIconName } from '@/src/data/tools';

interface ToolIconProps {
  name: ToolIconName;
  className?: string;
}

export function ToolIcon({ name, className = 'h-5 w-5' }: ToolIconProps) {
  switch (name) {
    case 'ImageDown':
      return <ImageDown className={className} aria-hidden="true" />;
    case 'FileImage':
      return <FileImage className={className} aria-hidden="true" />;
    case 'QrCode':
      return <QrCode className={className} aria-hidden="true" />;
    case 'FileText':
      return <FileText className={className} aria-hidden="true" />;
    case 'CalendarClock':
      return <CalendarClock className={className} aria-hidden="true" />;
  }
}
