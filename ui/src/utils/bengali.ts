const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumber(num: number): string {
  return String(num).replace(/\d/g, d => bengaliDigits[parseInt(d)]);
}

export function toBengaliPercent(num: number): string {
  return toBengaliNumber(Math.round(num)) + '%';
}

export function toBengaliDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = toBengaliNumber(date.getDate());
  const year = toBengaliNumber(date.getFullYear());
  const months = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const month = months[date.getMonth()];
  const hours = toBengaliNumber(date.getHours());
  const minutes = toBengaliNumber(date.getMinutes()).padStart(2, '০');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export const bengaliOptionLabels = ['ক', 'খ', 'গ', 'ঘ'];
