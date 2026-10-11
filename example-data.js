/*
 * SYNTHETIC DEMONSTRATION DATA. All clinics, sources and reviews are fictional
 * and written for this prototype. They are not real patient evidence.
 * English translations are prepared in advance, not machine- or human-verified.
 */
(function (root) {
  'use strict';

  var EXAMPLE_INPUT = {
    clinics: [
      {
        id: 'clinic-haneul-demo',
        name: 'Haneul Demo Clinic',
        aliases: ['하늘데모의원', '강남 하늘 데모 의원', 'Haneul Demo']
      },
      {
        id: 'clinic-byeol-sample',
        name: 'Byeol Sample Dermatology',
        aliases: ['별샘플피부과', 'Byeol Sample Derm.']
      }
    ],
    reviews: [
      {
        source: 'demo-source-a',
        sourceReviewId: 'A-1001',
        clinicName: '강남 하늘 데모 의원',
        language: 'ko',
        text: '상담이 친절했고 대기 시간이 짧았어요.',
        translationEn: '[Prepared translation] The consultation was kind and the wait was short.',
        rating: 5,
        date: '2026-09-01'
      },
      {
        source: 'demo-source-b',
        sourceReviewId: 'B-2001',
        clinicName: 'Haneul Demo Clinic',
        language: 'ko',
        text: '시설이 깨끗하고 설명이 자세했습니다.',
        translationEn: '[Prepared translation] The facility was clean and the explanation was detailed.',
        rating: 4,
        date: '2026-09-03'
      },
      {
        source: 'demo-source-a',
        sourceReviewId: 'A-1001',
        clinicName: '강남 하늘 데모 의원',
        language: 'ko',
        text: '상담이 친절했고 대기 시간이 짧았어요.',
        translationEn: '[Prepared translation] The consultation was kind and the wait was short.',
        rating: 5,
        date: '2026-09-01'
      },
      {
        source: 'demo-source-b',
        sourceReviewId: 'B-2002',
        clinicName: '하늘데모의원',
        language: 'ko',
        text: '상담이 친절했고, 대기 시간이 짧았어요!',
        translationEn: '[Prepared translation] The consultation was kind, and the wait was short!',
        date: '2026-09-05'
      },
      {
        source: 'demo-source-a',
        sourceReviewId: 'A-1002',
        clinicName: '별샘플피부과',
        language: 'ko',
        text: '시설이 깨끗하고 설명이 친절했습니다.',
        translationEn: '[Prepared translation] The facility was clean and the explanation was kind.',
        rating: 4,
        date: '2026-09-06'
      },
      {
        source: 'demo-source-b',
        sourceReviewId: 'B-3001',
        clinicName: '달 플레이스홀더 클리닉',
        language: 'ko',
        text: '예약 변경이 쉬웠어요.',
        translationEn: '[Prepared translation] Changing the appointment was easy.',
        date: '2026-09-07'
      },
      {
        source: 'demo-source-a',
        sourceReviewId: 'A-1003',
        clinicName: 'Byeol Sample Derm.',
        language: 'ko',
        text: '직원분들이 안내를 잘 해주셨어요.'
      },
      {
        source: 'demo-source-b',
        sourceReviewId: 'B-3002',
        clinicName: 'Byeol Sample Dermatology',
        language: 'ko',
        text: '상담이 친절했고 대기 시간이 짧았어요.',
        translationEn: '[Prepared translation] The consultation was kind and the wait was short.',
        rating: 5,
        date: '2026-09-08'
      }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EXAMPLE_INPUT: EXAMPLE_INPUT };
  } else {
    root.EXAMPLE_INPUT = EXAMPLE_INPUT;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
