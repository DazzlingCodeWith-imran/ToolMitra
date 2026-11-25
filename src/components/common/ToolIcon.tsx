import {
  CalendarClock,
  ClipboardList,
  Crop,
  EyeOff,
  FileCode2,
  FileImage,
  FilePenLine,
  Files,
  FileSpreadsheet,
  FileText,
  GitCompare,
  Hash,
  ImageDown,
  Images,
  LayoutGrid,
  Minimize2,
  PenTool,
  QrCode,
  RotateCw,
  ScanLine,
  ScanText,
  Scissors,
  Stamp,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { ToolIconName } from '@/src/data/tools';

interface ToolIconProps {
  name: ToolIconName;
  className?: string;
}

export function ToolIcon({ name, className = 'h-5 w-5' }: ToolIconProps) {
  switch (name) {
    case 'Workflow':
      return <Workflow className={className} aria-hidden="true" />;
    case 'Files':
      return <Files className={className} aria-hidden="true" />;
    case 'Scissors':
      return <Scissors className={className} aria-hidden="true" />;
    case 'LayoutGrid':
      return <LayoutGrid className={className} aria-hidden="true" />;
    case 'RotateCw':
      return <RotateCw className={className} aria-hidden="true" />;
    case 'Crop':
      return <Crop className={className} aria-hidden="true" />;
    case 'Minimize2':
      return <Minimize2 className={className} aria-hidden="true" />;
    case 'Wrench':
      return <Wrench className={className} aria-hidden="true" />;
    case 'ImageDown':
      return <ImageDown className={className} aria-hidden="true" />;
    case 'FileImage':
      return <FileImage className={className} aria-hidden="true" />;
    case 'Images':
      return <Images className={className} aria-hidden="true" />;
    case 'ScanLine':
      return <ScanLine className={className} aria-hidden="true" />;
    case 'FileCode2':
      return <FileCode2 className={className} aria-hidden="true" />;
    case 'FileSpreadsheet':
      return <FileSpreadsheet className={className} aria-hidden="true" />;
    case 'FilePenLine':
      return <FilePenLine className={className} aria-hidden="true" />;
    case 'Stamp':
      return <Stamp className={className} aria-hidden="true" />;
    case 'Hash':
      return <Hash className={className} aria-hidden="true" />;
    case 'ClipboardList':
      return <ClipboardList className={className} aria-hidden="true" />;
    case 'PenTool':
      return <PenTool className={className} aria-hidden="true" />;
    case 'EyeOff':
      return <EyeOff className={className} aria-hidden="true" />;
    case 'ScanText':
      return <ScanText className={className} aria-hidden="true" />;
    case 'GitCompare':
      return <GitCompare className={className} aria-hidden="true" />;
    case 'QrCode':
      return <QrCode className={className} aria-hidden="true" />;
    case 'FileText':
      return <FileText className={className} aria-hidden="true" />;
    case 'CalendarClock':
      return <CalendarClock className={className} aria-hidden="true" />;
  }
}
