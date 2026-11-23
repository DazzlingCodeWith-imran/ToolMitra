import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ToolDefinition } from '@/src/data/tools';
import { ToolIcon } from './ToolIcon';

interface ToolCardProps {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link
      to={tool.path}
      className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-blue-500/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/60"
    >
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-600 dark:border-slate-800 dark:bg-slate-950 dark:text-blue-400">
            <ToolIcon name={tool.iconName} className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {tool.category}
            <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-700">
              ·
            </span>
            Runs locally
          </span>
        </div>

        <h3 className="text-base font-semibold tracking-tight text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
          {tool.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {tool.shortDescription}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs font-semibold text-blue-600 dark:border-slate-800/80 dark:text-blue-400">
        <span>Open tool</span>
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
