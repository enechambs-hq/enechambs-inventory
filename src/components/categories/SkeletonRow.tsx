import React from 'react';

export default function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[200, 300, 80, 120, 80].map((w, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 rounded-md bg-gray-200 animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}
