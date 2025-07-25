"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import productStyles from "../../../../product.module.css";
import PageLayout from "../../../../components/PageLayout";

export default function LooseGemstonesPage() {
  const router = useRouter();

  const gemstoneTypesAvailable = [
  { label: "Coral (Moonga)", image: "/gemstone-moonga.png", type: "LG-Moonga" },
  { label: "Emerald (Panna)", image: "/gemstone-emerald.png", type: "LG-Emerald" },
  { label: "Blue Sapphire (Neelam)", image: "/gemstone-blue.png", type: "LG-Neelam" },
  { label: "Yellow Sapphire (Pukhraj)", image: "/gemstone-yellow.png", type: "LG-Pukhraj" },
  { label: "OPAL", image: "/gemstone-opal.png", type: "LG-Opal" },
];

  const gemstonePremiumTypesAvailable = [
  { label: "Yellow Sapphire (Premium)", image: "/gemstone-premium-pukhraj.png", type: "LG-PremiumPukhraj" },
];

const gemstoneTypesUpcoming = [
  { label: "Ruby (Maanik)", image: "/gemstone-ruby.png" },
  { label: "Pearl (Moti)", image: "/gemstone-pearl.png" },
  { label: "Hessonite (Gomed)", image: "/gemstone-gomed.png" },
  { label: "Cats Eye (Lehsuniya)", image: "/gemstone-lehsuniya.png" },
  { label: "Amethyst", image: "/gemstone-amethyst.png" },
  { label: "Marca Blue", image: "/gemstone-marcablue.png" },
  { label: "Marca Yellow", image: "/gemstone-marcayellow.png", type: "LG-Marca" },
];


const handleGemstoneClick = (type: string) => {
  if (type === "LG-PremiumPukhraj") {
    router.push("/catalog/gemstones/loose-gemstones/yellow-sapphire");
    return;
  }

  const input = prompt("How much weight (in ratti) are you looking for?");
  const ratti = parseFloat(input || "0");
  if (!isNaN(ratti) && ratti > 0) {
    router.push(`/catalog/gemstones/loose-gemstones?type=${type}&ratti=${ratti}`);
  } else {
    alert("Please enter a valid number.");
  }
};

  return (
    <PageLayout>
      <main style={{ backgroundColor: "#fff", padding: "1rem" }}>
<section id="gemstones" className={productStyles.catalogSection}>
  <h2 className={productStyles.sectionHeading}>Choose Your Gemstone</h2>
  <div className={productStyles.catalogGrid}>
    {gemstoneTypesAvailable.map(item => (
      <div
        key={item.label}
        className={productStyles.productCardHorizontal}
        onClick={() => handleGemstoneClick(item.type)}
        style={{ cursor: "pointer" }}
      >
        <Image
          src={item.image}
          alt={item.label}
          width={160}
          height={160}
          className={productStyles.productImg}
        />
        <h4 className={productStyles.productLabel}>{item.label}</h4>
      </div>
    ))}
  </div>
</section>

<section id="gemstonesPremium" className={productStyles.catalogSection}>
  <h2 className={productStyles.sectionHeading}>Premium Gemstones</h2>
  <div className={productStyles.catalogGrid}>
    {gemstonePremiumTypesAvailable.map(item => (
      <div
        key={item.label}
        className={productStyles.productCardHorizontal}
        onClick={() => handleGemstoneClick(item.type)}
        style={{ cursor: "pointer" }}
      >
        <Image
          src={item.image}
          alt={item.label}
          width={160}
          height={160}
          className={productStyles.productImg}
        />
        <h4 className={productStyles.productLabel}>{item.label}</h4>
      </div>
    ))}
  </div>
</section>

<section id="upcoming-gemstones" className={productStyles.catalogSection}>
  <h2 className={productStyles.sectionHeading}>Listings Under Progress</h2>
  <div className={productStyles.catalogGrid}>
    {gemstoneTypesUpcoming.map(item => (
      <div
        key={item.label}
        className={productStyles.productCardHorizontal}
        style={{ opacity: 0.5, pointerEvents: "none" }}
      >
        <Image
          src={item.image}
          alt={item.label}
          width={160}
          height={160}
          className={productStyles.productImg}
        />
        <h4 className={productStyles.productLabel}>{item.label}</h4>
      </div>
    ))}
  </div>
</section>


      </main>
    </PageLayout>
  );
}
