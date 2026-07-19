import React from "react";

export const Table: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({ children, className = "", ...props }) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full text-left border-collapse text-xs ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = "", ...props }) => {
  return (
    <thead className={`bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider border-b border-stone-200 dark:border-stone-800 ${className}`} {...props}>
      {children}
    </thead>
  );
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = "", ...props }) => {
  return (
    <tbody className={`divide-y divide-stone-200 dark:divide-stone-800 ${className}`} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className = "", ...props }) => {
  return (
    <tr className={`hover:bg-stone-50/50 dark:hover:bg-stone-800/25 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
};

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, className = "", ...props }) => {
  return (
    <th className={`py-3.5 px-5 select-text ${className}`} {...props}>
      {children}
    </th>
  );
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, className = "", ...props }) => {
  return (
    <td className={`py-3.5 px-5 ${className}`} {...props}>
      {children}
    </td>
  );
};
