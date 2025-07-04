// layout.tsx
export const metadata = {
  title: "Lab Grown Diamonds | City Jeweller",
  description: "Explore handpicked lab-grown solitaires – fancy shapes, fancy colours, certified IGI diamonds.",
  openGraph: {
    title: "Lab Grown Diamonds | City Jeweller",
    description: "Explore handpicked lab-grown solitaires – fancy shapes, fancy colours, certified IGI diamonds.",
    url: "https://www.cityjeweller.in/catalog/labgrown",
    type: "website",
    images: [
      {
        url: "https://www.cityjeweller.in/assets/labgrown-thumbnail-wide.png",
        width: 1200,
        height: 630,
        alt: "Lab Grown Diamonds – City Jeweller",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lab Grown Diamonds | City Jeweller",
    description: "Explore handpicked lab-grown solitaires.",
    images: ["https://www.cityjeweller.in/assets/labgrown-thumbnail-wide.png"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
