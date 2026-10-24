import {
  BadgePercent,
  Clapperboard,
  Code2,
  GraduationCap,
  Hourglass,
  Infinity as InfinityIcon,
  ListChecks,
  Megaphone,
  Palette,
  School,
  Server,
  ShieldCheck,
  Sparkles,
  Tv,
} from "lucide-react";
import BranchedMenu, { type BranchedMenuSection } from "@/components/effects/BranchedMenu";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  ai: <Sparkles />,
  design: <Palette />,
  "video-audio": <Clapperboard />,
  hosting: <Server />,
  development: <Code2 />,
  productivity: <ListChecks />,
  marketing: <Megaphone />,
  education: <GraduationCap />,
  entertainment: <Tv />,
  security: <ShieldCheck />,
};

/** Desktop category navigation (BranchedMenu). Navigation only — filters live in FilterForm. */
export default function CategoryNav({ categories, active }: { categories: { slug: string; name: string }[]; active: string }) {
  const items: BranchedMenuSection[] = [
    { label: "All deals", value: "all", href: "/deals" },
    {
      label: "Categories",
      children: categories.map((c) => ({ value: `category:${c.slug}`, label: c.name, href: `/categories/${c.slug}`, icon: CATEGORY_ICONS[c.slug] })),
    },
    {
      label: "Offer types",
      children: [
        { value: "type:student", label: "Student offers", href: "/students", icon: <School /> },
        { value: "type:coupon", label: "Coupons", href: "/coupons", icon: <BadgePercent /> },
        { value: "type:free_trial", label: "Free trials & credits", href: "/free-trials", icon: <Hourglass /> },
        { value: "type:lifetime", label: "Lifetime deals", href: "/lifetime-deals", icon: <InfinityIcon /> },
      ],
    },
  ];
  return <BranchedMenu items={items} active={active} defaultOpen={[1]} ariaLabel="Browse categories" />;
}
