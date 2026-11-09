import { format } from 'date-fns';

const TAGS: Array<[string, string]> = [
  ['DELETE', 'bg-red-50 text-red-800 border-red-200'],
  ['VOID', 'bg-red-50 text-red-800 border-red-200'],
  ['LOGIN', 'bg-[#e8f5ee] text-[#14693f] border-[#b9e0c9]'],
  ['LOGOUT', 'bg-gray-100 text-gray-700 border-gray-200'],
  ['SALE', 'bg-blue-50 text-blue-800 border-blue-200'],
  ['CREDIT', 'bg-amber-50 text-amber-800 border-amber-200'],
  ['COLLECTION', 'bg-amber-50 text-amber-800 border-amber-200'],
  ['INVENTORY', 'bg-orange-50 text-orange-800 border-orange-200'],
];

function tagClass(action: string): string {
  const upper = action.toUpperCase();
  return TAGS.find(([k]) => upper.includes(k))?.[1] ?? 'bg-[#f6efe0] text-[#5d5645] border-[#eadfc8]';
}

/** The coloured action label. Text is shown as the API gives it (underscores become spaces). */
export function ActionTag({ action }: { action: string }) {
  return (
    <span className={`inline-block max-w-full break-words rounded-full border px-2.5 py-0.5 text-sm font-medium first-letter:uppercase ${tagClass(action)}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

export const formatEventTime = (iso: string) => format(new Date(iso), 'MMM d, yyyy · h:mm a');
