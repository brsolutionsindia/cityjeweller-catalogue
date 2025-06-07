"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import footerStyles from "../footer.module.css";
import navbarStyles from "../navbar.module.css";
import productStyles from "../product.module.css";
import "../globals.css";

export default function LooseGemstonesPage() {
  const router = useRouter();

  useEffect(() => {
  }, []);

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
    <main style={{ backgroundColor: "#fff", padding: "1rem" }}>
      {/* Navbar */}
      <nav className={`${navbarStyles.navbar} flex flex-wrap items-center justify-between gap-4`} style={{ borderRadius: "12px", padding: "1rem", backgroundColor: "#f9f9f9" }}>
        <div className={navbarStyles.branding}>
          <Image src="/logo.png" alt="Logo" width={80} height={30} className={navbarStyles.logoImg} />
        </div>
        <ul className={navbarStyles.navLinksScrollable}>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/#catalogue">Catalog</Link></li>
          <li><Link href="/#contact">Contact</Link></li>
        </ul>
      </nav>

      {/* Gemstone Grid */}
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

      {/* Footer */}
      <footer className={footerStyles.footer} id="contact">
        <p>📞 <a href="https://api.whatsapp.com/send?phone=919023130944&text=Hi%2C%20I%20want%20to%20know%20more%20about%20Gemstones." target="_blank" rel="noopener noreferrer">+91-90231-30944</a></p>
        <div className={footerStyles.socialIcons}>
          <a href="https://www.facebook.com/cityJewellersIndia/" target="_blank" rel="noopener noreferrer" className={footerStyles.iconCircle}>
            <Image src="/facebook-icon.png" alt="Facebook" width={30} height={30} />
          </a>
        </div>
      </footer>

      <a href="https://api.whatsapp.com/send?phone=919023130944" className={footerStyles.whatsappBtn} target="_blank" rel="noopener noreferrer">
        <Image src="/whatsapp-icon.png" alt="WhatsApp" width={100} height={60} style={{ objectFit: "contain" }} />
      </a>
    </main>
  );
}
