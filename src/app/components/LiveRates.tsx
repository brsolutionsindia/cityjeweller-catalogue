'use client';

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import OfferBar from './OfferBar';
import OfferBarSilver from './OfferBarSilver';

export default function LiveRates() {
  const [goldRate, setGoldRate] = useState('—');
  const [silverRate, setSilverRate] = useState('—');
  const [rateDate, setRateDate] = useState('');

  useEffect(() => {
    const goldRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const silverRef = ref(db, 'Global SKU/Rates/Silver');
    const dateRef = ref(db, 'Global SKU/Rates/Date');

    onValue(goldRef, (s) => setGoldRate(s.val()));
    onValue(silverRef, (s) => setSilverRate(s.val()));
    onValue(dateRef, (s) => setRateDate(s.val()));
  }, []);

  return (
    <>
      <OfferBar goldRate={goldRate} rateDate={rateDate} />
      <OfferBarSilver silverRate={silverRate} rateDate={rateDate} />
    </>
  );
}
