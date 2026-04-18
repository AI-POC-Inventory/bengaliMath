import { useEffect, useState } from 'react';
import { toBengaliNumber } from '../utils/bengali';
import { getDueReviews, getReviewRecommendation } from '../utils/mistakes';

interface Review {
  questionId: string;
  questionText: string;
  questionType: string;
  correctAnswer: string;
  difficulty: string;
  topicName: string;
  chapterName: string;
  nextReviewDate: string;
  intervalDays: number;
  timesFailed: number;
}

interface Props {
  userId: number;
  darkMode: boolean;
  onStartReview?: (reviews: Review[]) => void;
  compact?: boolean;
}

export default function ReviewSchedule({ userId, darkMode, onStartReview, compact = false }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const bg = darkMode ? '#16213e' : '#ffffff';
  const text = darkMode ? '#e2e8f0' : '#1e293b';
  const subText = darkMode ? '#94a3b8' : '#64748b';
  const borderColor = darkMode ? '#2d3748' : '#e2e8f0';
  const accentBg = darkMode ? '#1a365d' : '#ebf4ff';

  useEffect(() => {
    fetchReviews();
  }, [userId]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const [reviewData, recData] = await Promise.all([
        getDueReviews(userId),
        getReviewRecommendation(userId),
      ]);

      setReviews(reviewData.reviews);
      setRecommendation(recData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: bg,
        borderRadius: compact ? '0.75rem' : '1rem',
        padding: compact ? '1rem' : '1.5rem',
        border: `1px solid ${borderColor}`,
        textAlign: 'center',
        color: subText,
      }}>
        লোড হচ্ছে...
      </div>
    );
  }

  // Compact mode for dashboard
  if (compact) {
    return (
      <div style={{
        background: bg,
        borderRadius: '0.75rem',
        padding: '1.25rem',
        border: `1px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '2rem' }}>📅</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: text }}>
              পর্যালোচনা সময়সূচী
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: subText }}>
              {reviews.length > 0
                ? `${toBengaliNumber(reviews.length)}টি প্রশ্ন পর্যালোচনা করার সময়`
                : 'কোনো পর্যালোচনা নেই'}
            </p>
          </div>
          {reviews.length > 0 && (
            <div style={{
              background: '#fbbf24',
              color: '#78350f',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1.25rem',
            }}>
              {toBengaliNumber(reviews.length)}
            </div>
          )}
        </div>

        {reviews.length > 0 && onStartReview && (
          <button
            onClick={() => onStartReview(reviews)}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            পর্যালোচনা শুরু করুন
          </button>
        )}

        {recommendation && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: accentBg,
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            color: text,
          }}>
            💡 {recommendation.recommendation}
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div style={{
      background: bg,
      borderRadius: '1rem',
      padding: '2rem',
      border: `1px solid ${borderColor}`,
      fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', sans-serif",
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>📅</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: text }}>
              পর্যালোচনা সময়সূচী
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', color: subText }}>
              ব্যবধান পুনরাবৃত্তি ব্যবস্থা
            </p>
          </div>
        </div>

        {/* Recommendation Banner */}
        {recommendation && (
          <div style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            color: '#78350f',
            marginBottom: '1.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>💡</span>
              <div>
                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                  সুপারিশ
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  {recommendation.recommendation}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {reviews.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✨</div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: text, margin: '0 0 0.5rem' }}>
            আজ কোনো পর্যালোচনা নেই!
          </h3>
          <p style={{ fontSize: '1rem', color: subText, margin: 0 }}>
            চমৎকার! আপনি সময়সূচীতে আছেন। আগামীকাল আবার দেখুন।
          </p>
        </div>
      )}

      {/* Due Reviews */}
      {reviews.length > 0 && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: text }}>
                আজকের পর্যালোচনা ({toBengaliNumber(reviews.length)})
              </h3>
              {onStartReview && (
                <button
                  onClick={() => onStartReview(reviews)}
                  style={{
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  সব পর্যালোচনা করুন
                </button>
              )}
            </div>

            {/* Review List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {reviews.map((review, index) => (
                <div
                  key={review.questionId}
                  style={{
                    background: accentBg,
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                  }}>
                    {toBengaliNumber(index + 1)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', color: text, fontWeight: '500', marginBottom: '0.25rem' }}>
                      {review.questionText.substring(0, 80)}
                      {review.questionText.length > 80 && '...'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: subText }}>
                      {review.topicName} • {review.chapterName}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      background: review.difficulty === 'hard' ? '#fca5a5' : review.difficulty === 'medium' ? '#fcd34d' : '#86efac',
                      color: review.difficulty === 'hard' ? '#7f1d1d' : review.difficulty === 'medium' ? '#78350f' : '#064e3b',
                      fontWeight: '600',
                      display: 'inline-block',
                    }}>
                      {review.difficulty === 'easy' ? 'সহজ' : review.difficulty === 'medium' ? 'মধ্যম' : 'কঠিন'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: subText, marginTop: '0.25rem' }}>
                      {toBengaliNumber(review.timesFailed)} বার ভুল
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spaced Repetition Info */}
          <div style={{
            background: darkMode ? '#0f1419' : '#f8fafc',
            borderRadius: '0.75rem',
            padding: '1.25rem',
          }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: '600', color: text }}>
              📚 ব্যবধান পুনরাবৃত্তি কী?
            </h4>
            <div style={{ fontSize: '0.875rem', color: subText, lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 0.75rem' }}>
                ব্যবধান পুনরাবৃত্তি হল একটি শেখার কৌশল যেখানে প্রশ্নগুলি ক্রমবর্ধমান ব্যবধানে পর্যালোচনা করা হয়:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                <IntervalBadge days={1} darkMode={darkMode} />
                <IntervalBadge days={3} darkMode={darkMode} />
                <IntervalBadge days={7} darkMode={darkMode} />
                <IntervalBadge days={14} darkMode={darkMode} />
                <IntervalBadge days={30} darkMode={darkMode} />
              </div>
              <p style={{ margin: '0.75rem 0 0' }}>
                প্রতিবার আপনি সঠিকভাবে উত্তর দেন, ব্যবধান বৃদ্ধি পায়। ভুল হলে, এটি আবার শুরু হয়।
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IntervalBadge({ days, darkMode }: { days: number; darkMode: boolean }) {
  const bg = darkMode ? '#2d3748' : '#e2e8f0';
  const text = darkMode ? '#e2e8f0' : '#1e293b';

  return (
    <div style={{
      background: bg,
      borderRadius: '0.375rem',
      padding: '0.5rem',
      textAlign: 'center',
      fontSize: '0.75rem',
      color: text,
      fontWeight: '600',
    }}>
      {toBengaliNumber(days)} দিন
    </div>
  );
}
