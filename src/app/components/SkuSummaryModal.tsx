import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ref, get } from 'firebase/database';
import { db } from '../../firebaseConfig';

type Props = {
  skuId: string;
  onClose: () => void;
};

type SkuData = {
  gross: number;
  net: number;
  goldPurety: number;
  grTotalPrice: number;
  goldPrice?: string;
  gstPrice?: string;

  labour?: string;
  labourUnit?: string;
  labourPrice?: string;

  polish?: string;
  polishPrice?: string;
  miscPrice?: string;

  diam1?: string;
  d1Unit?: string;
  diam1Price?: string;

  stone1?: string;
  St1Unit?: string;
  stone1Rate?: string;
  St1RateUnit?: string;
  stone1Price?: string;

  stone2?: string;
  St2Unit?: string;
  stone2Rate?: string;
  St2RateUnit?: string;
  stone2Price?: string;

  NetUnit?: string;
};

const SkuSummaryModal: React.FC<Props> = ({ skuId, onClose }) => {
  const [skuData, setSkuData] = useState<SkuData | null>(null);
  const [imageUrl, setImageUrl] = useState('/product-placeholder.jpg');
  const [goldRate, setGoldRate] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(3);

  const formatINR = (value?: string | number) => {
    const num = Number(value || 0);
    return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  useEffect(() => {
    if (skuId) {
      const fetchData = async () => {
        try {
          const skuRef = ref(db, `Global SKU/SKU/${skuId}`);
          const skuSnap = await get(skuRef);
          if (skuSnap.exists()) setSkuData(skuSnap.val());

          const imgRef = ref(db, `Global SKU/Images/${skuId}/Primary`);
          const imgSnap = await get(imgRef);
          const url = imgSnap.val();
          if (url && typeof url === 'string' && url.startsWith('http')) setImageUrl(url);

          const rateRef = ref(db, 'Global SKU/Rates');
          const rateSnap = await get(rateRef);
          const rateData = rateSnap.val();
          if (rateData) {
            const key = `Gold ${skuSnap.val().goldPurety}kt`;
            setGoldRate(parseFloat(rateData[key] || '0'));
            setGstRate(parseFloat(rateData.GST || '3'));
          }
        } catch (error) {
          console.error('Error fetching SKU summary or rates:', error);
        }
      };
      fetchData();
    }
  }, [skuId]);

  const summary = useMemo(() => {
    if (!skuData) return null;

    const gross = parseFloat(String(skuData.gross || '0'));
    const net = parseFloat(String(skuData.net || '0'));
    const goldPrice = parseFloat(String(skuData.goldPrice || '0'));
    const onlyStone = goldPrice === 0;
    const noStone = gross === net;
    const NetUnit = skuData.NetUnit || '';
    const containsD = NetUnit.includes('S1');
    const containsSt = NetUnit.includes('S2');

    return { gross, net, goldPrice, onlyStone, noStone, containsD, containsSt };
  }, [skuData]);

  if (!skuData || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black bg-opacity-40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative flex flex-col">
  <div className="pb-32 px-4">
  <button className="absolute top-3 right-4 text-gray-500 hover:text-red-500 text-xl" onClick={onClose}>✕</button>

  {/* Product Image */}
        <div className="mb-4 text-center">
  <Image
    src={imageUrl}
    alt="SKU"
    width={280}
    height={280}
    className="rounded-lg border mx-auto"
  />
</div>

{/* Sticky Enquiry Button */}
<div className="sticky bottom-0 bg-white pt-4 pb-2 flex justify-center z-10">
  <a
    href={`https://wa.me/919023130944?text=${encodeURIComponent(
      `Hi, I am interested in your jewellery item - ${skuId}. Please confirm its availability and payment details.`
    )}`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-full shadow-md hover:bg-green-700 transition text-sm font-medium"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M20.52 3.48a12.07 12.07 0 0 0-17.05 0 11.89 11.89 0 0 0-2.44 3.76c-1.42 3.41-1.33 7.16.25 10.39L.31 23.69a.64.64 0 0 0 .88.88l5.06-1.97a12.11 12.11 0 0 0 5.69 1.44c6.63 0 12-5.37 12-12 0-3.21-1.25-6.22-3.48-8.44ZM12 21.6a9.6 9.6 0 0 1-5.1-1.45l-.37-.23-3.72 1.45 1.4-3.61-.25-.39A9.6 9.6 0 0 1 2.4 12c0-5.29 4.31-9.6 9.6-9.6 2.57 0 4.99 1 6.8 2.8A9.57 9.57 0 0 1 21.6 12c0 5.29-4.31 9.6-9.6 9.6Zm5.25-6.76c-.29-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.63.14-.19.29-.73.94-.9 1.13-.16.19-.33.21-.62.07a7.77 7.77 0 0 1-2.29-1.41 8.65 8.65 0 0 1-1.6-1.97c-.17-.3 0-.47.13-.61.14-.14.3-.33.45-.5.15-.17.2-.29.3-.48.1-.2.05-.36-.02-.5-.07-.15-.63-1.5-.86-2.05-.23-.55-.46-.47-.63-.47l-.53-.01c-.18 0-.47.07-.71.36s-.94.91-.94 2.22 1 2.57 1.14 2.74c.14.17 1.96 3.02 4.74 4.23 2.64 1.17 2.64.78 3.11.73.47-.05 1.53-.62 1.74-1.21.22-.6.22-1.12.15-1.21-.06-.1-.27-.16-.56-.31Z" />
    </svg>
    Enquire
  </a>
</div>



        {/* Price */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-4">
            {/* Price Info */}
            <div>
              <div className="text-2xl font-bold text-green-700">{formatINR(skuData.grTotalPrice ?? "0")}</div>
              <div className="text-sm text-gray-500 italic">MRP inclusive of all taxes</div>
            </div>
          </div>
        </div>

{/* Divider */}      
        <hr className="my-4" />

        {/* Product Details */}
        <div className="text-sm text-gray-700">
          <div className="font-semibold text-base text-gray-800 mb-4">🔍 Product Details</div>

          <div className="grid grid-cols-2 gap-y-1">
            <div><strong>Item Code:</strong> {skuId}</div>
            <div className="text-right"></div>

            {!summary.onlyStone && !summary.noStone && (
              <>
                <div><strong>Gross Weight:</strong> {skuData.gross} gm</div>
                <div className="text-right"></div>
              </>
            )}

            <div><strong>Net Weight:</strong> {skuData.net} gm ({skuData.goldPurety}kt) × {formatINR(goldRate ?? "0")}</div>
            <div className="text-right"> = {formatINR(skuData.goldPrice ?? "0")}</div>

            {summary.containsD && skuData.stone1 && parseFloat(skuData.stone1) > 0 && (
              <>
                <div><strong>Diamond:</strong> {skuData.stone1} {skuData.St1Unit} × {skuData.stone1Rate} {skuData.St1RateUnit} </div>
                <div className="text-right">= {formatINR(skuData.stone1Price ?? "0")}</div>
              </>
            )}

            {summary.containsSt && skuData.stone2 && parseFloat(skuData.stone2) > 0 && (
              <>
                <div><strong>Stone:</strong> {skuData.stone2} {skuData.St2Unit} × {skuData.stone2Rate} {skuData.St2RateUnit}</div>
                <div className="text-right">= {formatINR(skuData.stone2Price ?? "0")}</div>
              </>
            )}

            {skuData.labour && parseFloat(skuData.labour) > 0 && (
              <>
                <div><strong>Making Charges:</strong></div>
                <div className="text-right">= {formatINR(skuData.labourPrice ?? "0")}</div>
              </>
            )}

            {skuData.polish && parseFloat(skuData.polishPrice ?? "0") > 0 && (
              <>
                <div><strong>Polish:</strong></div>
                <div className="text-right">{formatINR(skuData.polishPrice ?? "0")}</div>
              </>
            )}

            {skuData.miscPrice && parseFloat(skuData.miscPrice ?? "0") > 0 && (
              <>
                <div><strong>Misc:</strong></div>
                <div className="text-right">{formatINR(skuData.miscPrice ?? "0")}</div>
              </>
            )}

            {skuData.gstPrice && (
              <>
                <div><strong>GST ({gstRate}%):</strong></div>
                <div className="text-right">= {formatINR(skuData.gstPrice ?? "0")}</div>
              </>
            )}
          </div>
        </div>

        {/* Highlights */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-4">
            {/* Certified Diamonds Logo - Left */}
            {summary.containsD && skuData.stone1 && parseFloat(skuData.stone1) > 0 && (
<>
              <Image
                src="/certified_diamonds.png"
                alt="Certified Diamonds"
                width={64}
                height={64}
                className="object-contain"
              />
</>
            )}

            {/* BIS Logo - Right */}
            <Image
              src="/bis.png"
              alt="BIS Hallmark"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
        </div>

	</div>
      </div>
    </div>
  );
};

export default SkuSummaryModal;
