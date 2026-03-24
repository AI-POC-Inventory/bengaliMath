import type { ClassData } from '../types';

export const curriculum: ClassData[] = [
  {
    id: 5,
    name: 'Class 5',
    bengaliName: 'পঞ্চম শ্রেণী',
    chapters: [
      {
        id: '5-1',
        name: 'যোগ ও বিয়োগ',
        description: 'বড় সংখ্যার যোগ ও বিয়োগ',
        topics: [
          {
            id: '5-1-1',
            name: 'বড় সংখ্যার যোগ',
            description: 'লক্ষ ও কোটি পর্যন্ত সংখ্যার যোগ',
            questions: [
              {
                id: '5-1-1-1',
                type: 'mcq',
                text: '৪৫,৬৭৮ + ৩২,৪৫৬ = ?',
                options: ['৭৮,১৩৪', '৭৮,০৩৪', '৭৯,১৩৪', '৭৭,১৩৪'],
                answer: 0,
                solution: 'প্রথমে এককের ঘর: ৮+৬=১৪, লিখি ৪ হাতে রাখি ১\nদশকের ঘর: ৭+৫+১=১৩, লিখি ৩ হাতে রাখি ১\nশতকের ঘর: ৬+৪+১=১১, লিখি ১ হাতে রাখি ১\nহাজারের ঘর: ৫+২+১=৮\nদশ হাজারের ঘর: ৪+৩=৭\nউত্তর: ৭৮,১৩৪',
                difficulty: 'easy',
              },
              {
                id: '5-1-1-2',
                type: 'mcq',
                text: '১,২৩,৪৫৬ + ৩,৪৫,৬৭৮ = ?',
                options: ['৪,৬৯,১৩৪', '৪,৬৮,১৩৪', '৪,৬৯,০৩৪', '৫,৬৯,১৩৪'],
                answer: 0,
                solution: 'ধাপে ধাপে যোগ করি:\nএককের ঘর: ৬+৮=১৪, লিখি ৪ হাতে ১\nদশকের ঘর: ৫+৭+১=১৩, লিখি ৩ হাতে ১\nশতকের ঘর: ৪+৬+১=১১, লিখি ১ হাতে ১\nহাজারের ঘর: ৩+৫+১=৯\nদশ হাজারের ঘর: ২+৪=৬\nলক্ষের ঘর: ১+৩=৪\nউত্তর: ৪,৬৯,১৩৪',
                difficulty: 'medium',
              },
              {
                id: '5-1-1-3',
                type: 'short',
                text: 'একটি বিদ্যালয়ে ছাত্র আছে ১,২৩৫ জন এবং ছাত্রী আছে ৯৮৭ জন। মোট শিক্ষার্থী কত জন?',
                answer: '২,২২২',
                solution: 'ছাত্র + ছাত্রী = মোট শিক্ষার্থী\n১,২৩৫ + ৯৮৭\n= ২,২২২\nউত্তর: ২,২২২ জন',
                difficulty: 'easy',
              },
            ],
          },
          {
            id: '5-1-2',
            name: 'বড় সংখ্যার বিয়োগ',
            description: 'লক্ষ ও কোটি পর্যন্ত সংখ্যার বিয়োগ',
            questions: [
              {
                id: '5-1-2-1',
                type: 'mcq',
                text: '৮৫,৪৩২ - ৩৪,২১৮ = ?',
                options: ['৫১,২১৪', '৫১,৩১৪', '৫১,২১৩', '৫০,২১৪'],
                answer: 0,
                solution: 'ধাপে ধাপে বিয়োগ করি:\nএককের ঘর: ২-৮, ধার নিই, ১২-৮=৪\nদশকের ঘর: ২-১-১=০ (পরের ঘর থেকে ধার নেওয়া)\nমোট: ৫১,২১৪\nউত্তর: ৫১,২১৪',
                difficulty: 'easy',
              },
              {
                id: '5-1-2-2',
                type: 'short',
                text: 'একটি গুদামে ৫,৬৭৮ কেজি চাল ছিল। ৩,৪৫৬ কেজি চাল বিক্রি করা হলে কত কেজি চাল বাকি থাকবে?',
                answer: '২,২২২',
                solution: 'বাকি চাল = মোট চাল - বিক্রিত চাল\n= ৫,৬৭৮ - ৩,৪৫৬\n= ২,২২২ কেজি\nউত্তর: ২,২২২ কেজি',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
      {
        id: '5-2',
        name: 'গুণ ও ভাগ',
        description: 'সংখ্যার গুণ ও ভাগ',
        topics: [
          {
            id: '5-2-1',
            name: 'গুণ',
            description: 'বড় সংখ্যার গুণ',
            questions: [
              {
                id: '5-2-1-1',
                type: 'mcq',
                text: '৩৪৫ × ২৩ = ?',
                options: ['৭,৯৩৫', '৭,৮৩৫', '৮,০৩৫', '৭,৯৪৫'],
                answer: 0,
                solution: '৩৪৫ × ২৩\n= ৩৪৫ × ২০ + ৩৪৫ × ৩\n= ৬,৯০০ + ১,০৩৫\n= ৭,৯৩৫\nউত্তর: ৭,৯৩৫',
                difficulty: 'medium',
              },
              {
                id: '5-2-1-2',
                type: 'short',
                text: 'একটি বাক্সে ১২টি কলম আছে। ৪৫টি বাক্সে মোট কতটি কলম আছে?',
                answer: '৫৪০',
                solution: 'মোট কলম = প্রতি বাক্সে কলম × বাক্সের সংখ্যা\n= ১২ × ৪৫\n= ৫৪০টি\nউত্তর: ৫৪০টি কলম',
                difficulty: 'easy',
              },
            ],
          },
          {
            id: '5-2-2',
            name: 'ভাগ',
            description: 'বড় সংখ্যার ভাগ',
            questions: [
              {
                id: '5-2-2-1',
                type: 'mcq',
                text: '৯৬০ ÷ ১৫ = ?',
                options: ['৬৪', '৬৩', '৬৫', '৬২'],
                answer: 0,
                solution: '৯৬০ ÷ ১৫\n১৫ × ৬ = ৯০\n৯৬ ÷ ১৫: ১৫ × ৬ = ৯০, ৯৬-৯০ = ৬\nএখন ৬০ ÷ ১৫ = ৪\nসুতরাং ৯৬০ ÷ ১৫ = ৬৪\nউত্তর: ৬৪',
                difficulty: 'medium',
              },
              {
                id: '5-2-2-2',
                type: 'short',
                text: '৭৫৬টি আম ২১ জনের মধ্যে সমানভাগে ভাগ করলে প্রত্যেকে কতটি আম পাবে?',
                answer: '৩৬',
                solution: 'প্রত্যেকের আম = মোট আম ÷ মানুষের সংখ্যা\n= ৭৫৬ ÷ ২১\n= ৩৬টি\nযাচাই: ৩৬ × ২১ = ৭৫৬ ✓\nউত্তর: ৩৬টি আম',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
      {
        id: '5-3',
        name: 'পরিমাপ',
        description: 'দৈর্ঘ্য, ভার ও আয়তনের পরিমাপ',
        topics: [
          {
            id: '5-3-1',
            name: 'দৈর্ঘ্যের পরিমাপ',
            description: 'মিটার, সেন্টিমিটার, কিলোমিটার',
            questions: [
              {
                id: '5-3-1-1',
                type: 'mcq',
                text: '৩ কিলোমিটার = কত মিটার?',
                options: ['৩,০০০ মিটার', '৩০০ মিটার', '৩০,০০০ মিটার', '৩০ মিটার'],
                answer: 0,
                solution: '১ কিলোমিটার = ১,০০০ মিটার\nসুতরাং ৩ কিলোমিটার = ৩ × ১,০০০ = ৩,০০০ মিটার\nউত্তর: ৩,০০০ মিটার',
                difficulty: 'easy',
              },
              {
                id: '5-3-1-2',
                type: 'short',
                text: 'একটি মাঠের দৈর্ঘ্য ১৫০ মিটার এবং প্রস্থ ৮০ মিটার। মাঠের পরিসীমা কত?',
                answer: '৪৬০ মিটার',
                solution: 'আয়তকার মাঠের পরিসীমা = ২ × (দৈর্ঘ্য + প্রস্থ)\n= ২ × (১৫০ + ৮০)\n= ২ × ২৩০\n= ৪৬০ মিটার\nউত্তর: ৪৬০ মিটার',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 6,
    name: 'Class 6',
    bengaliName: 'ষষ্ঠ শ্রেণী',
    chapters: [
      {
        id: '6-1',
        name: 'ভগ্নাংশ',
        description: 'সাধারণ ভগ্নাংশের যোগ, বিয়োগ, গুণ ও ভাগ',
        topics: [
          {
            id: '6-1-1',
            name: 'ভগ্নাংশের যোগ ও বিয়োগ',
            description: 'সমহর ও অসমহর ভগ্নাংশের যোগ বিয়োগ',
            questions: [
              {
                id: '6-1-1-1',
                type: 'mcq',
                text: '১/৩ + ১/৬ = ?',
                options: ['১/২', '২/৯', '১/৩', '৩/৬'],
                answer: 0,
                solution: 'অসমহর ভগ্নাংশ যোগ:\nLCM(৩,৬) = ৬\n১/৩ = ২/৬\n২/৬ + ১/৬ = ৩/৬ = ১/২\nউত্তর: ১/২',
                difficulty: 'easy',
              },
              {
                id: '6-1-1-2',
                type: 'mcq',
                text: '৩/৪ - ১/৬ = ?',
                options: ['৭/১২', '২/৩', '১/২', '৫/১২'],
                answer: 0,
                solution: 'LCM(৪,৬) = ১২\n৩/৪ = ৯/১২\n১/৬ = ২/১২\n৯/১২ - ২/১২ = ৭/১২\nউত্তর: ৭/১২',
                difficulty: 'medium',
              },
              {
                id: '6-1-1-3',
                type: 'short',
                text: 'রহিমের কাছে একটি পিজ্জার ২/৫ অংশ ছিল। সে তার বন্ধুকে ১/৫ অংশ দিলে তার কাছে কতটুকু রইল?',
                answer: '১/৫',
                solution: 'বাকি পিজ্জা = ২/৫ - ১/৫ = ১/৫\nউত্তর: ১/৫ অংশ',
                difficulty: 'easy',
              },
            ],
          },
          {
            id: '6-1-2',
            name: 'ভগ্নাংশের গুণ ও ভাগ',
            description: 'ভগ্নাংশের গুণ ও ভাগ',
            questions: [
              {
                id: '6-1-2-1',
                type: 'mcq',
                text: '২/৩ × ৩/৪ = ?',
                options: ['১/২', '৬/১২', '২/৪', '৮/১২'],
                answer: 0,
                solution: 'ভগ্নাংশ গুণ: লব × লব / হর × হর\n= (২×৩) / (৩×৪)\n= ৬/১২\n= ১/২ (লঘু করে)\nউত্তর: ১/২',
                difficulty: 'medium',
              },
              {
                id: '6-1-2-2',
                type: 'short',
                text: '৪/৫ ÷ ২/৩ = ?',
                answer: '৬/৫',
                solution: 'ভগ্নাংশ ভাগ: প্রথম ভগ্নাংশকে দ্বিতীয় ভগ্নাংশের বিপরীত দিয়ে গুণ করি\n৪/৫ ÷ ২/৩ = ৪/৫ × ৩/২\n= (৪×৩)/(৫×২)\n= ১২/১০\n= ৬/৫\nউত্তর: ৬/৫ বা ১১/৫',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
      {
        id: '6-2',
        name: 'দশমিক ভগ্নাংশ',
        description: 'দশমিক সংখ্যার যোগ, বিয়োগ, গুণ ও ভাগ',
        topics: [
          {
            id: '6-2-1',
            name: 'দশমিকের যোগ ও বিয়োগ',
            description: 'দশমিক সংখ্যার যোগ বিয়োগ',
            questions: [
              {
                id: '6-2-1-1',
                type: 'mcq',
                text: '৩.৪৫ + ২.৬৭ = ?',
                options: ['৬.১২', '৬.০২', '৬.২২', '৫.১২'],
                answer: 0,
                solution: 'দশমিক বিন্দু সারিবদ্ধ করে যোগ করি:\n  ৩.৪৫\n+ ২.৬৭\n------\n  ৬.১২\nউত্তর: ৬.১২',
                difficulty: 'easy',
              },
              {
                id: '6-2-1-2',
                type: 'short',
                text: '১২.৫ - ৮.৭৫ = ?',
                answer: '৩.৭৫',
                solution: 'দশমিক বিন্দু সারিবদ্ধ করে বিয়োগ করি:\n  ১২.৫০\n-  ৮.৭৫\n--------\n   ৩.৭৫\nউত্তর: ৩.৭৫',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
      {
        id: '6-3',
        name: 'সংখ্যা পদ্ধতি',
        description: 'মৌলিক সংখ্যা, যৌগিক সংখ্যা, গ.সা.গু, ল.সা.গু',
        topics: [
          {
            id: '6-3-1',
            name: 'মৌলিক ও যৌগিক সংখ্যা',
            description: 'সংখ্যা চেনা ও শ্রেণিবিভাগ',
            questions: [
              {
                id: '6-3-1-1',
                type: 'mcq',
                text: 'নিচের কোনটি মৌলিক সংখ্যা?',
                options: ['১৭', '১৫', '২১', '২৭'],
                answer: 0,
                solution: '১৭ → ১ এবং ১৭ ছাড়া কোনো গুণনীয়ক নেই। তাই ১৭ মৌলিক।\n১৫ = ৩ × ৫ (যৌগিক)\n২১ = ৩ × ৭ (যৌগিক)\n২৭ = ৩ × ৯ (যৌগিক)\nউত্তর: ১৭',
                difficulty: 'easy',
              },
              {
                id: '6-3-1-2',
                type: 'mcq',
                text: '১২ ও ১৮-এর গ.সা.গু কত?',
                options: ['৬', '৩', '৯', '১২'],
                answer: 0,
                solution: '১২ = ২ × ২ × ৩\n১৮ = ২ × ৩ × ৩\nসাধারণ গুণনীয়ক: ২ এবং ৩\nগ.সা.গু = ২ × ৩ = ৬\nউত্তর: ৬',
                difficulty: 'medium',
              },
            ],
          },
          {
            id: '6-3-2',
            name: 'ল.সা.গু',
            description: 'লঘিষ্ঠ সাধারণ গুণিতক',
            questions: [
              {
                id: '6-3-2-1',
                type: 'mcq',
                text: '৪, ৬ এবং ৮-এর ল.সা.গু কত?',
                options: ['২৪', '১২', '৪৮', '৯৬'],
                answer: 0,
                solution: '৪ = ২²\n৬ = ২ × ৩\n৮ = ২³\nল.সা.গু = ২³ × ৩ = ৮ × ৩ = ২৪\nউত্তর: ২৪',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 7,
    name: 'Class 7',
    bengaliName: 'সপ্তম শ্রেণী',
    chapters: [
      {
        id: '7-1',
        name: 'অনুপাত ও সমানুপাত',
        description: 'অনুপাত, সমানুপাত এবং প্রত্যক্ষ ও ব্যস্ত সমানুপাত',
        topics: [
          {
            id: '7-1-1',
            name: 'অনুপাত',
            description: 'দুটি রাশির অনুপাত',
            questions: [
              {
                id: '7-1-1-1',
                type: 'mcq',
                text: '১৫ : ২৫ অনুপাতটিকে সরলতম আকারে লিখলে কত হবে?',
                options: ['৩:৫', '৫:৩', '১:২', '২:৩'],
                answer: 0,
                solution: '১৫ : ২৫\nউভয়কে গ.সা.গু দিয়ে ভাগ করি। গ.সা.গু(১৫,২৫) = ৫\n১৫÷৫ : ২৫÷৫ = ৩ : ৫\nউত্তর: ৩:৫',
                difficulty: 'easy',
              },
              {
                id: '7-1-1-2',
                type: 'short',
                text: 'রহিম ও করিমের বয়সের অনুপাত ৩:৪। রহিমের বয়স ১৫ বছর হলে করিমের বয়স কত?',
                answer: '২০ বছর',
                solution: 'রহিম : করিম = ৩ : ৪\nরহিমের বয়স = ১৫ বছর\nপ্রতিটি অংশ = ১৫ ÷ ৩ = ৫ বছর\nকরিমের বয়স = ৪ × ৫ = ২০ বছর\nউত্তর: ২০ বছর',
                difficulty: 'easy',
              },
            ],
          },
          {
            id: '7-1-2',
            name: 'সমানুপাত ও প্রত্যক্ষ/ব্যস্ত সমানুপাত',
            description: 'সমানুপাতের ধারণা ও সমস্যা সমাধান',
            questions: [
              {
                id: '7-1-2-1',
                type: 'mcq',
                text: '৫টি কলম ৩০ টাকায় কিনলে ১২টি কলমের দাম কত?',
                options: ['৭২ টাকা', '৬০ টাকা', '৮৪ টাকা', '৯০ টাকা'],
                answer: 0,
                solution: 'প্রত্যক্ষ সমানুপাত:\n৫টি কলম → ৩০ টাকা\n১টি কলম → ৩০÷৫ = ৬ টাকা\n১২টি কলম → ৬×১২ = ৭২ টাকা\nউত্তর: ৭২ টাকা',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
      {
        id: '7-2',
        name: 'শতকরা',
        description: 'শতকরা হিসাব, লাভ-ক্ষতি',
        topics: [
          {
            id: '7-2-1',
            name: 'শতকরা নির্ণয়',
            description: 'শতকরা বের করার পদ্ধতি',
            questions: [
              {
                id: '7-2-1-1',
                type: 'mcq',
                text: '৮০-র ২৫% কত?',
                options: ['২০', '২৫', '১৬', '৩২'],
                answer: 0,
                solution: '৮০-র ২৫%\n= ৮০ × ২৫/১০০\n= ৮০ × ১/৪\n= ২০\nউত্তর: ২০',
                difficulty: 'easy',
              },
              {
                id: '7-2-1-2',
                type: 'mcq',
                text: '৪০ হলো কোন সংখ্যার ৩২%?',
                options: ['১২৫', '১৫০', '১০০', '১৩০'],
                answer: 0,
                solution: 'ধরি, সংখ্যাটি = x\nx-এর ৩২% = ৪০\nx × ৩২/১০০ = ৪০\nx = ৪০ × ১০০/৩২\nx = ৪০০০/৩২ = ১২৫\nউত্তর: ১২৫',
                difficulty: 'medium',
              },
              {
                id: '7-2-1-3',
                type: 'short',
                text: 'একটি জিনিস ৫০০ টাকায় কিনে ৬০০ টাকায় বিক্রি করলে কত শতাংশ লাভ হলো?',
                answer: '২০%',
                solution: 'ক্রয়মূল্য = ৫০০ টাকা\nবিক্রয়মূল্য = ৬০০ টাকা\nলাভ = ৬০০ - ৫০০ = ১০০ টাকা\nলাভ% = (লাভ/ক্রয়মূল্য) × ১০০\n= (১০০/৫০০) × ১০০\n= ২০%\nউত্তর: ২০% লাভ',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
      {
        id: '7-3',
        name: 'বীজগণিতের ভূমিকা',
        description: 'চল রাশি, সমীকরণের ধারণা',
        topics: [
          {
            id: '7-3-1',
            name: 'সরল সমীকরণ',
            description: 'এক চল বিশিষ্ট সরল সমীকরণ সমাধান',
            questions: [
              {
                id: '7-3-1-1',
                type: 'mcq',
                text: '২x + ৫ = ১৫ হলে x-এর মান কত?',
                options: ['৫', '৪', '৬', '৩'],
                answer: 0,
                solution: '২x + ৫ = ১৫\n২x = ১৫ - ৫\n২x = ১০\nx = ১০ ÷ ২\nx = ৫\nউত্তর: x = ৫',
                difficulty: 'easy',
              },
              {
                id: '7-3-1-2',
                type: 'mcq',
                text: '৩y - ৭ = ১৪ হলে y-এর মান কত?',
                options: ['৭', '৮', '৬', '৫'],
                answer: 0,
                solution: '৩y - ৭ = ১৪\n৩y = ১৪ + ৭\n৩y = ২১\ny = ২১ ÷ ৩\ny = ৭\nউত্তর: y = ৭',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 8,
    name: 'Class 8',
    bengaliName: 'অষ্টম শ্রেণী',
    chapters: [
      {
        id: '8-1',
        name: 'সূচক ও ঘাত',
        description: 'সূচকের নিয়মাবলী ও প্রয়োগ',
        topics: [
          {
            id: '8-1-1',
            name: 'সূচকের নিয়মাবলী',
            description: 'সূচকের গুণ, ভাগ ও অন্যান্য নিয়ম',
            questions: [
              {
                id: '8-1-1-1',
                type: 'mcq',
                text: 'a³ × a⁴ = ?',
                options: ['a⁷', 'a¹²', 'a¹', 'a⁶'],
                answer: 0,
                solution: 'একই ভিত্তির সূচকের গুণ:\na³ × a⁴ = a^(৩+৪) = a⁷\nনিয়ম: aᵐ × aⁿ = a^(m+n)\nউত্তর: a⁷',
                difficulty: 'easy',
              },
              {
                id: '8-1-1-2',
                type: 'mcq',
                text: '(2³)² = ?',
                options: ['64', '32', '16', '128'],
                answer: 0,
                solution: '(2³)² = 2^(৩×২) = 2⁶ = 64\nনিয়ম: (aᵐ)ⁿ = a^(m×n)\n২⁶ = ২×২×২×২×২×২ = ৬৪\nউত্তর: ৬৪',
                difficulty: 'easy',
              },
              {
                id: '8-1-1-3',
                type: 'short',
                text: 'সরল করো: 2⁵ ÷ 2² = ?',
                answer: '2³ = 8',
                solution: 'একই ভিত্তির সূচকের ভাগ:\n2⁵ ÷ 2² = 2^(৫-২) = 2³ = ৮\nনিয়ম: aᵐ ÷ aⁿ = a^(m-n)\nউত্তর: 2³ = ৮',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
      {
        id: '8-2',
        name: 'বর্গ ও বর্গমূল',
        description: 'পূর্ণ বর্গ সংখ্যা ও বর্গমূল',
        topics: [
          {
            id: '8-2-1',
            name: 'বর্গমূল নির্ণয়',
            description: 'ভাজন পদ্ধতিতে বর্গমূল',
            questions: [
              {
                id: '8-2-1-1',
                type: 'mcq',
                text: '√১৪৪ = ?',
                options: ['১২', '১১', '১৩', '১৪'],
                answer: 0,
                solution: '১৪৪ = ১২ × ১২ = ১২²\nঅথবা: ১২² = ১৪৪\nসুতরাং √১৪৪ = ১২\nউত্তর: ১২',
                difficulty: 'easy',
              },
              {
                id: '8-2-1-2',
                type: 'mcq',
                text: '√৩২৪ = ?',
                options: ['১৮', '১৬', '২০', '১৭'],
                answer: 0,
                solution: '১৮² = ৩২৪\nযাচাই: ১৮ × ১৮ = ৩২৪ ✓\nউত্তর: ১৮',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
      {
        id: '8-3',
        name: 'সরল ও যৌগিক সুদ',
        description: 'সরল সুদ ও যৌগিক সুদের হিসাব',
        topics: [
          {
            id: '8-3-1',
            name: 'সরল সুদ',
            description: 'সরল সুদের সূত্র ও প্রয়োগ',
            questions: [
              {
                id: '8-3-1-1',
                type: 'mcq',
                text: '৫,০০০ টাকার ৪ বছরের ১০% সরল সুদ কত?',
                options: ['২,০০০ টাকা', '১,৫০০ টাকা', '২,৫০০ টাকা', '১,০০০ টাকা'],
                answer: 0,
                solution: 'সরল সুদের সূত্র: সুদ = (আসল × হার × সময়) / ১০০\n= (৫০০০ × ১০ × ৪) / ১০০\n= ২,০০,০০০ / ১০০\n= ২,০০০ টাকা\nউত্তর: ২,০০০ টাকা',
                difficulty: 'easy',
              },
              {
                id: '8-3-1-2',
                type: 'short',
                text: 'কত বছরে ৮,০০০ টাকার সরল সুদ ৫% হারে ২,০০০ টাকা হবে?',
                answer: '৫ বছর',
                solution: 'সূত্র: সময় = (সুদ × ১০০) / (আসল × হার)\n= (২০০০ × ১০০) / (৮০০০ × ৫)\n= ২,০০,০০০ / ৪০,০০০\n= ৫ বছর\nউত্তর: ৫ বছর',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 9,
    name: 'Class 9',
    bengaliName: 'নবম শ্রেণী',
    chapters: [
      {
        id: '9-1',
        name: 'বাস্তব সংখ্যা',
        description: 'মূলদ ও অমূলদ সংখ্যা, বাস্তব সংখ্যার ধর্ম',
        topics: [
          {
            id: '9-1-1',
            name: 'মূলদ ও অমূলদ সংখ্যা',
            description: 'সংখ্যার শ্রেণিবিভাগ',
            questions: [
              {
                id: '9-1-1-1',
                type: 'mcq',
                text: 'নিচের কোনটি অমূলদ সংখ্যা?',
                options: ['√২', '√৪', '√৯', '√১৬'],
                answer: 0,
                solution: '√২ = ১.৪১৪২... (অসীম অনাবর্তী দশমিক) → অমূলদ\n√৪ = ২ (মূলদ)\n√৯ = ৩ (মূলদ)\n√১৬ = ৪ (মূলদ)\nউত্তর: √২',
                difficulty: 'easy',
              },
              {
                id: '9-1-1-2',
                type: 'mcq',
                text: '০.৩৩৩... (পুনরাবৃত্তি) কোন সংখ্যা?',
                options: ['১/৩', '১/৪', '১/৬', '১/৯'],
                answer: 0,
                solution: '০.৩৩৩... = ০.৩̄\nধরি x = ০.৩̄\n১০x = ৩.৩̄\n১০x - x = ৩.৩̄ - ০.৩̄\n৯x = ৩\nx = ৩/৯ = ১/৩\nউত্তর: ১/৩',
                difficulty: 'medium',
              },
              {
                id: '9-1-1-3',
                type: 'short',
                text: 'প্রমাণ করো যে √২ অমূলদ সংখ্যা।',
                answer: 'বিপরীত ধরে প্রমাণ',
                solution: 'বিপরীত ধরি, √২ মূলদ সংখ্যা।\nতাহলে √২ = p/q (যেখানে p,q পূর্ণসংখ্যা, গ.সা.গু=১)\n২ = p²/q²\np² = ২q²\nসুতরাং p² জোড়, অর্থাৎ p জোড়।\np = ২m ধরি\n(২m)² = ২q²\n৪m² = ২q²\nq² = ২m²\nসুতরাং q² জোড়, q জোড়।\nকিন্তু তাহলে p এবং q উভয়ই জোড়, যা গ.সা.গু=১-এর বিপরীত।\nঅতএব √২ অমূলদ সংখ্যা (প্রমাণিত)।',
                difficulty: 'hard',
              },
            ],
          },
        ],
      },
      {
        id: '9-2',
        name: 'বহুপদী',
        description: 'বহুপদী রাশি, গুণন ও উৎপাদকে বিশ্লেষণ',
        topics: [
          {
            id: '9-2-1',
            name: 'বহুপদীর উৎপাদকে বিশ্লেষণ',
            description: 'মধ্যপদ বিভাজন পদ্ধতি',
            questions: [
              {
                id: '9-2-1-1',
                type: 'mcq',
                text: 'x² + 5x + 6 কে উৎপাদকে বিশ্লেষণ করলে পাই:',
                options: ['(x+2)(x+3)', '(x+1)(x+6)', '(x+3)(x+2)', '(x-2)(x-3)'],
                answer: 0,
                solution: 'x² + 5x + 6\nদুটি সংখ্যা খুঁজি যাদের যোগফল ৫ এবং গুণফল ৬\n২ + ৩ = ৫ এবং ২ × ৩ = ৬\nx² + 5x + 6 = x² + 2x + 3x + 6\n= x(x+2) + 3(x+2)\n= (x+2)(x+3)\nউত্তর: (x+2)(x+3)',
                difficulty: 'medium',
              },
              {
                id: '9-2-1-2',
                type: 'mcq',
                text: 'x² - 9 কে উৎপাদকে বিশ্লেষণ করলে পাই:',
                options: ['(x+3)(x-3)', '(x-9)(x+1)', '(x-3)²', '(x+9)(x-1)'],
                answer: 0,
                solution: 'x² - 9 = x² - 3²\nএটি a² - b² = (a+b)(a-b) সূত্রের আকার\n= (x+3)(x-3)\nউত্তর: (x+3)(x-3)',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
      {
        id: '9-3',
        name: 'পরিসংখ্যান',
        description: 'তথ্য সংগ্রহ, উপস্থাপন ও বিশ্লেষণ',
        topics: [
          {
            id: '9-3-1',
            name: 'কেন্দ্রীয় প্রবণতার পরিমাপ',
            description: 'গড়, মধ্যমা ও প্রচুরক',
            questions: [
              {
                id: '9-3-1-1',
                type: 'mcq',
                text: '৫, ৭, ৩, ৮, ৯, ২, ৬ সংখ্যাগুলোর গড় কত?',
                options: ['৫.৭১', '৬', '৫.৫', '৬.৫'],
                answer: 0,
                solution: 'গড় = যোগফল / সংখ্যার পরিমাণ\nযোগফল = ৫+৭+৩+৮+৯+২+৬ = ৪০\nসংখ্যার পরিমাণ = ৭\nগড় = ৪০/৭ ≈ ৫.৭১\nউত্তর: ৫.৭১ (প্রায়)',
                difficulty: 'easy',
              },
              {
                id: '9-3-1-2',
                type: 'short',
                text: '৩, ৫, ৭, ৭, ৮, ৯, ১১ সংখ্যাগুলোর মধ্যমা ও প্রচুরক কত?',
                answer: 'মধ্যমা = ৭, প্রচুরক = ৭',
                solution: 'তথ্যগুলো সাজানো আছে: ৩, ৫, ৭, ৭, ৮, ৯, ১১\nমোট = ৭টি সংখ্যা (বিজোড়)\nমধ্যমা = মাঝের সংখ্যা = ৪র্থ সংখ্যা = ৭\nপ্রচুরক = সবচেয়ে বেশিবার আসা সংখ্যা = ৭ (দুইবার আসে)\nউত্তর: মধ্যমা = ৭, প্রচুরক = ৭',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 10,
    name: 'Class 10',
    bengaliName: 'দশম শ্রেণী',
    chapters: [
      {
        id: '10-1',
        name: 'দ্বিঘাত সমীকরণ',
        description: 'দ্বিঘাত সমীকরণের সমাধান',
        topics: [
          {
            id: '10-1-1',
            name: 'শ্রীধরাচার্যের সূত্র',
            description: 'দ্বিঘাত সমীকরণের সাধারণ সমাধান',
            questions: [
              {
                id: '10-1-1-1',
                type: 'mcq',
                text: 'x² - 5x + 6 = 0 সমীকরণের মূল দুটি কত?',
                options: ['x = 2 বা x = 3', 'x = -2 বা x = -3', 'x = 1 বা x = 6', 'x = -1 বা x = -6'],
                answer: 0,
                solution: 'x² - 5x + 6 = 0\n(x-2)(x-3) = 0\nউৎপাদকে বিশ্লেষণ:\nx-2 = 0 বা x-3 = 0\nx = 2 বা x = 3\nউত্তর: x = 2 বা x = 3',
                difficulty: 'easy',
              },
              {
                id: '10-1-1-2',
                type: 'mcq',
                text: '২x² + ৭x + ৩ = 0 সমীকরণের মূল দুটি কত? (শ্রীধরাচার্যের সূত্র ব্যবহার করে)',
                options: ['x = -1/2 বা x = -3', 'x = 1/2 বা x = 3', 'x = -1 বা x = -3/2', 'x = 1 বা x = 3/2'],
                answer: 0,
                solution: 'ax² + bx + c = 0 → x = [-b ± √(b²-4ac)] / 2a\na=২, b=৭, c=৩\nবিভেদক = ৭² - 4×২×৩ = ৪৯ - ২৪ = ২৫\n√২৫ = ৫\nx = (-৭ ± ৫) / (২×২)\nx₁ = (-৭+৫)/৪ = -২/৪ = -১/২\nx₂ = (-৭-৫)/৪ = -১২/৪ = -৩\nউত্তর: x = -১/২ বা x = -৩',
                difficulty: 'hard',
              },
              {
                id: '10-1-1-3',
                type: 'short',
                text: '৩x² - ১০x + ৩ = 0 এর মূল দুটি নির্ণয় করো।',
                answer: 'x = 3 বা x = 1/3',
                solution: '৩x² - ১০x + ৩ = 0\na=৩, b=-১০, c=৩\nবিভেদক = (-১০)² - ৪×৩×৩ = ১০০ - ৩৬ = ৬৪\n√৬৪ = ৮\nx = (১০ ± ৮) / ৬\nx₁ = (১০+৮)/৬ = ১৮/৬ = ৩\nx₂ = (১০-৮)/৬ = ২/৬ = ১/৩\nউত্তর: x = ৩ বা x = ১/৩',
                difficulty: 'hard',
              },
            ],
          },
        ],
      },
      {
        id: '10-2',
        name: 'সমান্তর প্রগতি',
        description: 'সমান্তর প্রগতির সাধারণ পদ ও সমষ্টি',
        topics: [
          {
            id: '10-2-1',
            name: 'সমান্তর প্রগতির ধর্ম',
            description: 'AP-এর সাধারণ পদ ও সমষ্টি নির্ণয়',
            questions: [
              {
                id: '10-2-1-1',
                type: 'mcq',
                text: '২, ৫, ৮, ১১, ... ধারাটির ১০তম পদ কত?',
                options: ['২৯', '৩২', '২৬', '৩৫'],
                answer: 0,
                solution: 'প্রথম পদ a = ২, সাধারণ অন্তর d = ৩\nn তম পদ: aₙ = a + (n-1)d\na₁₀ = ২ + (১০-১) × ৩\n= ২ + ৯ × ৩\n= ২ + ২৭\n= ২৯\nউত্তর: ২৯',
                difficulty: 'medium',
              },
              {
                id: '10-2-1-2',
                type: 'short',
                text: '৩, ৭, ১১, ১৫, ... ধারাটির প্রথম ১৫টি পদের সমষ্টি কত?',
                answer: '৪৭৫',
                solution: 'প্রথম পদ a = ৩, সাধারণ অন্তর d = ৪, n = ১৫\nসমষ্টির সূত্র: Sₙ = n/2 × [2a + (n-1)d]\nS₁₅ = ১৫/২ × [২×৩ + (১৫-১)×৪]\n= ১৫/২ × [৬ + ৫৬]\n= ১৫/২ × ৬২\n= ১৫ × ৩১\n= ৪৬৫\nউত্তর: ৪৬৫',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
      {
        id: '10-3',
        name: 'ত্রিকোণমিতি',
        description: 'sin, cos, tan এবং তাদের ব্যবহার',
        topics: [
          {
            id: '10-3-1',
            name: 'ত্রিকোণমিতিক অনুপাত',
            description: 'sin, cos, tan-এর সংজ্ঞা ও মান',
            questions: [
              {
                id: '10-3-1-1',
                type: 'mcq',
                text: 'sin 30° + cos 60° = ?',
                options: ['১', '১/২', '√২', '√৩/২'],
                answer: 0,
                solution: 'sin 30° = ১/২\ncos 60° = ১/২\nsin 30° + cos 60° = ১/২ + ১/২ = ১\nউত্তর: ১',
                difficulty: 'easy',
              },
              {
                id: '10-3-1-2',
                type: 'mcq',
                text: 'tan 45° × sin 90° = ?',
                options: ['১', '০', '√২', '১/২'],
                answer: 0,
                solution: 'tan 45° = ১\nsin 90° = ১\ntan 45° × sin 90° = ১ × ১ = ১\nউত্তর: ১',
                difficulty: 'easy',
              },
              {
                id: '10-3-1-3',
                type: 'short',
                text: 'একটি উল্লম্ব খুঁটির ছায়ার দৈর্ঘ্য খুঁটির সমান। সূর্যের উন্নতি কোণ কত?',
                answer: '৪৫°',
                solution: 'ধরি খুঁটির উচ্চতা = h, ছায়ার দৈর্ঘ্য = h\ntan θ = উচ্চতা / ছায়ার দৈর্ঘ্য\ntan θ = h/h = ১\nθ = tan⁻¹(১) = ৪৫°\nউত্তর: সূর্যের উন্নতি কোণ = ৪৫°',
                difficulty: 'medium',
              },
            ],
          },
        ],
      },
      {
        id: '10-4',
        name: 'বৃত্ত',
        description: 'বৃত্তের ধর্ম, স্পর্শক ও ছেদক',
        topics: [
          {
            id: '10-4-1',
            name: 'বৃত্তের ধর্ম',
            description: 'কেন্দ্রস্থ কোণ, বৃত্তস্থ কোণ ও স্পর্শক',
            questions: [
              {
                id: '10-4-1-1',
                type: 'mcq',
                text: 'একটি বৃত্তের ব্যাসার্ধ ৭ সে.মি. হলে পরিধি কত? (π = ২২/৭)',
                options: ['৪৪ সে.মি.', '২২ সে.মি.', '৩৩ সে.মি.', '৫৫ সে.মি.'],
                answer: 0,
                solution: 'পরিধি = ২πr\n= ২ × ২২/৭ × ৭\n= ২ × ২২\n= ৪৪ সে.মি.\nউত্তর: ৪৪ সে.মি.',
                difficulty: 'easy',
              },
            ],
          },
        ],
      },
    ],
  },
];

export function getClassData(classId: number): ClassData | undefined {
  return curriculum.find(c => c.id === classId);
}

export function getChapter(classId: number, chapterId: string) {
  return getClassData(classId)?.chapters.find(ch => ch.id === chapterId);
}

export function getTopic(classId: number, topicId: string) {
  const cls = getClassData(classId);
  if (!cls) return undefined;
  for (const ch of cls.chapters) {
    const t = ch.topics.find(t => t.id === topicId);
    if (t) return { topic: t, chapter: ch };
  }
  return undefined;
}

export function getAllQuestions(classId: number, chapterId?: string, topicId?: string, difficulty?: string) {
  const cls = getClassData(classId);
  if (!cls) return [];
  const questions: Array<{ question: typeof cls.chapters[0]['topics'][0]['questions'][0], topicId: string, chapterId: string }> = [];
  for (const ch of cls.chapters) {
    if (chapterId && ch.id !== chapterId) continue;
    for (const t of ch.topics) {
      if (topicId && t.id !== topicId) continue;
      for (const q of t.questions) {
        if (difficulty && q.difficulty !== difficulty) continue;
        questions.push({ question: q, topicId: t.id, chapterId: ch.id });
      }
    }
  }
  return questions;
}
