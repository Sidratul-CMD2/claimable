import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DealsExplorer from "@/components/discovery/DealsExplorer";
import { db } from "@/server/db";
import { categories } from "@/server/db/schema";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function getCategory(slug: string) {
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return row?.isVisible ? row : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return { title: "Category not found" };
  return { title: `${category.name} deals`, description: category.description, alternates: { canonical: `/categories/${category.slug}` } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await getCategory((await params).slug);
  if (!category) notFound();
  return (
    <DealsExplorer
      path={`/categories/${category.slug}`}
      searchParams={await searchParams}
      fixed={{ categories: [category.slug] }}
      heading={`${category.name} deals`}
      intro={category.description}
      navActive={`category:${category.slug}`}
    />
  );
}
