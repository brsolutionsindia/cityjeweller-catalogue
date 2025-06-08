"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import productStyles from "../product.module.css";
import PageLayout from "../components/PageLayout";

export default function LooseGemstonesPage() {
  const router = useRouter();

  const gemstoneTypes = [
    { label: "Moonga", image: "/gemstone-moonga.png", type: "LG-Moonga" },
    { label: "Emerald", image: "/gemstone-emerald.png", type: "LG-Emerald" },
    { label: "Blue Sapphire", image: "/gemstone-blue.png", type: "LG-Neelam" },
    { label: "Yellow Sapphire", image: "/gemstone-yellow.png", type: "LG-Pukhraj" },
    { label: "OPAL", image: "/gemstone-opal.png", type: "LG-Opal" },
  ];

  const handleGemstoneClick = (type: string) => {
    const input = prompt("How much weight (in ratti) are you looking for?");
    const ratti = parseFloat(input || "0");
    if (!isNaN(ratti) && ratti > 0) {
      router.push(`/catalog?type=${type}&ratti=${ratti}`);
    } else {
      alert("Please enter a valid number.");
    }
  };

  return (
    <PageLayout>
      <main style={{ backgroundColor: "#fff", padding: "1rem" }}>
        <section id="gemstones" className={productStyles.catalogSection}>
          <h2 className={productStyles.sectionHeading}>Choose Your Gemstone</h2>
          <div className={productStyles.catalogContainer}>
            <div className={productStyles.catalogSlider}>
              <div className={productStyles.horizontalScroll}>
                {gemstoneTypes.map(item => (
                  <div
                    key={item.label}
                    className={productStyles.productCardHorizontal}
                    onClick={() => handleGemstoneClick(item.type)}
                    style={{ cursor: "pointer" }}
                  >
                    <Image src={item.image} alt={item.label} width={160} height={160} className={productStyles.productImg} />
                    <h4 className={productStyles.productLabel}>{item.label}</h4>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
