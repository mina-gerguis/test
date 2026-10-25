"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FaSearch,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaSubway,
  FaRobot,
  FaCompass,
  FaPlusCircle,
  FaArrowLeft,
  FaLightbulb,
  FaChevronLeft,
  FaChevronRight,
  FaInbox,
  FaBus,
  FaTrain,
  FaRoute,
  FaBookOpen,
  FaExternalLinkAlt
} from "react-icons/fa";
import { supabase } from "@/lib/supabase";
import {
  initialPlaces,
  CATEGORIES_STRUCTURE,
  Place,
  normalizePlaceCategory,
  getMainCategoryImage
} from "@/data/places";
import dynamic from "next/dynamic";
import AdSlider from "@/components/AdSlider";
import { FamousCity, INITIAL_FAMOUS_CITIES, getStoredCities, saveStoredCities } from "@/data/cities";
import CityDetailModal from "@/components/cities/CityDetailModal";
import styles from "./home.module.css";

const WeatherComfortWidget = dynamic(() => import("@/components/WeatherComfortWidget"), { ssr: false });

// ── 1. دالة توحيد وتنظيف النصوص العربية لبحث دقيق ──
function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .trim();
}

// ── دالة إزالة السوابق والتعريفات العربية (الـ، للـ، بالـ، والـ) لضمان تطابق مرن ──
function cleanArabicWord(word: string): string {
  let w = word.trim();
  if (w.length <= 3) return w;

  if (w.startsWith("وال") && w.length > 4) {
    w = w.substring(3);
  } else if (w.startsWith("ال") && w.length > 3) {
    w = w.substring(2);
  } else if (w.startsWith("بال") && w.length > 4) {
    w = w.substring(3);
  } else if (w.startsWith("لل") && w.length > 3) {
    w = w.substring(2);
  }

  return w;
}

// ── دالة تقسيم نص البحث إلى كلمات نظيفة مفلترة ──
function getSearchWords(text: string): string[] {
  const normalized = normalizeArabic(text);
  const stopWords = ["في", "من", "ب", "بـ", "بمنطقة", "بمحافظة", "مدينة", "حي", "علي", "الي", "التي", "الذي", "مع"];

  return normalized
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0 && !stopWords.includes(w))
    .map(cleanArabicWord);
}

// ── دالة تنظيف الكلمات في النص الكامل للمقارنة ──
function getSearchCleanedText(text: string): string {
  if (!text) return "";
  return normalizeArabic(text)
    .split(/\s+/)
    .map(w => w.trim())
    .map(cleanArabicWord)
    .filter(Boolean)
    .join(" ");
}

// ── 2. دالة تحويل وتوحيد بيانات المكان من Supabase لضمان التطابق مع دليل الأماكن ──
function mapDbPlaceToPlace(dbPlace: any): Place {
  const rawCategory = dbPlace.category;
  const initialSubCats = Array.isArray(dbPlace.sub_categories) ? [...dbPlace.sub_categories] : [];
  const { category: finalCategory, categoryLabel: defaultLabel, subCategories: finalSubCategories } = normalizePlaceCategory(rawCategory, initialSubCats);

  return {
    id: dbPlace.id,
    name: dbPlace.name,
    name_en: dbPlace.name_en || "",
    category: finalCategory,
    categoryLabel: dbPlace.category_label || defaultLabel || finalCategory,
    subCategories: finalSubCategories,
    place_type: dbPlace.place_type || "",
    governorate: dbPlace.governorate || "",
    city: dbPlace.city || "",
    briefLocation: dbPlace.brief_location || dbPlace.address || "",
    fullAddress: dbPlace.full_address || dbPlace.address || "",
    phones: Array.isArray(dbPlace.phones) ? dbPlace.phones : (dbPlace.phone ? [dbPlace.phone] : []),
    googleMapsUrl: dbPlace.google_maps_url || "",
    images: Array.isArray(dbPlace.images) ? dbPlace.images : (dbPlace.image_url ? [dbPlace.image_url] : []),
    workingHours: dbPlace.working_hours || "",
    rating: dbPlace.rating || 4.5,
    description: dbPlace.description || "",
    branches: Array.isArray(dbPlace.branches) ? dbPlace.branches.map((b: any) => ({
      id: b.id,
      place_id: b.place_id,
      name: b.name,
      governorate: b.governorate,
      city: b.city,
      fullAddress: b.full_address,
      latitude: b.latitude,
      longitude: b.longitude,
      phones: b.phones || [],
      googleMapsUrl: b.google_maps_url,
      workingHours: b.working_hours,
      isMain: b.is_main,
    })) : []
  };
}

// ── 3. فهرس خدمات وصفحات الموقع المباشرة (Site Services Index) ──
interface SiteServiceItem {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  icon: string;
  badge: string;
  keywords: string[];
}

const SITE_SERVICES: SiteServiceItem[] = [
  {
    id: "save-location",
    label: "أحفظ مكاني",
    subtitle: "حفظ موقعك الحالي بدقة 100% ورابط خرائط جوجل",
    href: "/save-location",
    icon: "cairo.webp",
    badge: "ميزة ذكية 🎯",
    keywords: ["احفظ مكاني", "احفظ مكاني الحالي", "مكان ركنتي", "ركنة عربيتي", "موقعي", "حفظ الموقع", "google maps", "خرائط جوجل", "احفظ مكان", "gps", "save location"]
  },
  {
    id: "metro",
    label: "خريطة مترو الأنفاق",
    subtitle: "خطوط ومحطات مترو القاهرة الكبرى",
    href: "/metro",
    icon: "metro.webp",
    badge: "مواصلات المترو",
    keywords: ["مترو", "المترو", "انفاق", "الانفاق", "محطات المترو", "خط المترو", "تذكرة المترو", "مترو القاهرة", "metro"]
  },
  {
    id: "monorail",
    label: "قطار المونوريل",
    subtitle: "محطات ومسار قطار المونوريل المعلق",
    href: "/monorail",
    icon: "Cairo_monorail_east.webp",
    badge: "قطار معلق",
    keywords: ["منورايل", "المنورايل", "قطار العاصمة", "العاصمة الادارية", "اكتوبر", "monorail"]
  },
  {
    id: "lrt",
    label: "القطار الكهربائي الخفيف LRT",
    subtitle: "محطات ومواعيد القطار الكهربائي",
    href: "/lrt",
    icon: "Cairo_lrt.webp",
    badge: "القطار الكهربائي",
    keywords: ["lrt", "القطار الكهربائي", "كهربائي", "القطار الخفيف", "قطار العاشر"]
  },
  {
    id: "brt",
    label: "الأتوبيس الترددي السريع (BRT)",
    subtitle: "محطات ومسار الأتوبيس على الطريق الدائري",
    href: "/brt",
    icon: "brt.webp",
    badge: "أتوبيس ترددي",
    keywords: ["brt", "ترددي", "الترددي", "اتوبيس ترددي", "الأتوبيس الترددي", "الدائري", "الطريق الدائري", "حافلات سريعة"]
  },
  {
    id: "railways",
    label: "قطارات السكك الحديدية",
    subtitle: "مواعيد وقطارات القاهرة والمحافظات",
    href: "/railways",
    icon: "Cairo_train.webp",
    badge: "سكك حديد مصر",
    keywords: ["قطار", "قطارات", "سكك حديد", "سكك حديد مصر", "محطة رمسيس", "رمسيس", "قطار الصعيد", "قطار اسكندرية"]
  },
  {
    id: "directory",
    label: "دليل الهاتف والأكواد",
    subtitle: "أرقام الطوارئ وأكواد شبكات المحمول",
    href: "/directory",
    icon: "cairo.webp",
    badge: "دليل الهواتف",
    keywords: ["تليفون", "تليفونات", "هاتف", "اكواد", "أكواد", "طوارئ", "فودافون", "اورنج", "اتصالات", "وي", "ارقام", "خدمة العملاء"]
  },
  {
    id: "directions",
    label: "ازاي اروح والمواقف",
    subtitle: "دليل الوصول لأي وجهة في مصر",
    href: "/directions",
    icon: "arab_republic _of_egypt.webp",
    badge: "اتجاهات ومسارات",
    keywords: ["ازاي اروح", "ازاي اوصل", "اروح ازاي", "مواصلات", "طريق", "مسار", "اتجاهات"]
  },
  {
    id: "ai-planner",
    label: "مخطط الرحلات الذكي",
    subtitle: "تخطيط يومك بالذكاء الاصطناعي",
    href: "/ai-planner",
    icon: "ai.webp",
    badge: "ذكاء اصطناعي",
    keywords: ["خروجة", "تخطيط", "مخطط", "رحلات", "برنامج", "ذكاء", "ذكاء اصطناعي", "ai", "افكار خروج"]
  },
  {
    id: "bus-stations",
    label: "مواقف الأتوبيسات",
    subtitle: "محطات الأتوبيسات بالقاهرة والجيزة",
    href: "/bus-stations",
    icon: "bus.webp",
    badge: "مواقف أتوبيس",
    keywords: ["اتوبيس", "أتوبيس", "موقف اتوبيس", "نقل عام", "مواقف الأتوبيس"]
  },
  {
    id: "microbus-stations",
    label: "مواقف السرفيس والميكروباص",
    subtitle: "خطوط ومواقف السرفيس بين المحافظات",
    href: "/microbus-stations",
    icon: "microbus.webp",
    badge: "مواقف ميكروباص",
    keywords: ["ميكروباص", "موقف ميكروباص", "سرفيس", "موقف سرفيس", "مواقف"]
  },
  {
    id: "airports",
    label: "المطارات المصرية",
    subtitle: "معلومات مطار القاهرة والمطارات الدولية",
    href: "/airports",
    icon: "airport.webp",
    badge: "مطارات وموانئ",
    keywords: ["مطار", "مطارات", "مطار القاهرة", "سفنكس", "موانئ", "ميناء"]
  },
  {
    id: "ports",
    label: "الموانئ المصرية",
    subtitle: "دليل الموانئ المصرية والملاحية",
    href: "/ports",
    icon: "arab_republice.webp",
    badge: "الموانئ",
    keywords: ["ميناء", "الميناء", "ميناء السخنة", "ميناء الاسكندرية"]
  },
  {
    id: "blog",
    label: "مدونة ومقالات خريطة القاهرة",
    subtitle: "أدلة الترانزيت، النصائح، والأماكن",
    href: "/blog",
    icon: "cairo.webp",
    badge: "مقالات وأدلة",
    keywords: ["مدونة", "مقالات", "مقال", "اخبار", "أخبار", "دليل", "blog", "نصائح", "مقاله"]
  }
];

interface HomeBlogItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  category: string;
  created_at?: string;
}

const DEFAULT_HOME_BLOGS: HomeBlogItem[] = [
  {
    id: "sample-1",
    title: "دليل المواصلات الشامل في القاهرة والجيزة: الوسيلة الأسرع والأوفر",
    slug: "cairo-transportation-guide",
    category: "المواصلات والحركة",
    excerpt: "تعرف على أحدث الخطوط والأسعار في مترو الأنفاق والقطار الكهربائي LRT والمنوريل.",
  },
  {
    id: "sample-2",
    title: "أفضل 10 أماكن للخروج والتنزه في القاهرة بعيداً عن صخب المدينة",
    slug: "top-10-places-cairo",
    category: "دليل القاهرة والجيزة",
    excerpt: "استكشف حدائق ومقاهي ومتاحف هادئة توفر لك تجربة ممتعة مع العائلة أو الأصدقاء.",
  },
  {
    id: "sample-3",
    title: "كيف تستخدم محطة القطار الكهربائي LRT بالكامل مع أسعار التذاكر",
    slug: "lrt-train-full-guide",
    category: "الترانزيت والقطارات",
    excerpt: "دليلك الشامل لخطوات استقلال LRT ومحطات التبادل مع الخط الثالث للمترو.",
  }
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMac, setIsMac] = useState(false);

  // ── حساب الإحصائيات الحقيقية والديناميكية للموقع ──
  const [activePlaces, setActivePlaces] = useState<Place[]>(initialPlaces);
  const [placesCount, setPlacesCount] = useState<number>(initialPlaces.length);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [homeBlogs, setHomeBlogs] = useState<HomeBlogItem[]>(DEFAULT_HOME_BLOGS);
  const [famousCities, setFamousCities] = useState<FamousCity[]>([]);
  const [selectedCityModal, setSelectedCityModal] = useState<FamousCity | null>(null);
  const [citiesScrollProgress, setCitiesScrollProgress] = useState(0);

  const citiesScrollRef = useRef<HTMLDivElement>(null);

  // Mouse drag to scroll states for cities section
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);
  const [dragMoved, setDragMoved] = useState(false);

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const handleCitiesScroll = () => {
    if (citiesScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = citiesScrollRef.current;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll > 0) {
        const progress = Math.min(1, Math.max(0, Math.abs(scrollLeft) / maxScroll));
        setCitiesScrollProgress(progress);
      }
      const absScroll = Math.abs(scrollLeft);
      setCanScrollPrev(absScroll > 5);
      setCanScrollNext(absScroll < maxScroll - 5);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!citiesScrollRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - citiesScrollRef.current.offsetLeft);
    setDragScrollLeft(citiesScrollRef.current.scrollLeft);
    setDragMoved(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !citiesScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - citiesScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      setDragMoved(true);
    }
    citiesScrollRef.current.scrollLeft = dragScrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
  };

  const scrollPrev = () => {
    if (citiesScrollRef.current) {
      const container = citiesScrollRef.current;
      const isRtl = getComputedStyle(container).direction === "rtl";
      const scrollAmount = 260;
      container.scrollBy({
        left: isRtl ? scrollAmount : -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const scrollNext = () => {
    if (citiesScrollRef.current) {
      const container = citiesScrollRef.current;
      const isRtl = getComputedStyle(container).direction === "rtl";
      const scrollAmount = 260;
      container.scrollBy({
        left: isRtl ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const scrollToCity = (index: number) => {
    if (citiesScrollRef.current) {
      const container = citiesScrollRef.current;
      const cards = container.querySelectorAll(":scope > div");
      if (cards && cards[index]) {
        const card = cards[index] as HTMLElement;
        card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleCitiesScroll();
    }, 150);

    const handleResize = () => {
      handleCitiesScroll();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [famousCities]);

  useEffect(() => {
    let isMounted = true;

    const handleCitiesUpdated = () => {
      if (isMounted) {
        setFamousCities(getStoredCities());
      }
    };
    window.addEventListener("cities_updated", handleCitiesUpdated);

    async function fetchDynamicStats() {
      try {
        let currentPlaces: Place[] = [...initialPlaces];

        if (isMounted) {
          setFamousCities(getStoredCities());
        }

        if (supabase) {
          const { data: dbCities, error: citiesErr } = await supabase
            .from("famous_cities")
            .select("*")
            .order("order_index", { ascending: true });

          const { data: dbLandmarks } = await supabase
            .from("city_landmarks")
            .select("*");

          if (!citiesErr && dbCities && dbCities.length > 0) {
            const landmarksByCity: Record<string, any[]> = {};
            if (dbLandmarks) {
              dbLandmarks.forEach((lm: any) => {
                const cid = lm.city_id;
                if (!landmarksByCity[cid]) {
                  landmarksByCity[cid] = [];
                }
                landmarksByCity[cid].push(lm);
              });
            }

            const mappedCities: FamousCity[] = dbCities.map((c: any) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              cover_image: c.cover_image,
              population: c.population || "",
              area: c.area || "",
              density: c.density || "",
              temperature: c.temperature || "",
              overview: c.overview || "",
              order_index: c.order_index || 0,
              landmarks: Array.isArray(landmarksByCity[c.id])
                ? landmarksByCity[c.id].map((l: any) => ({
                  id: l.id,
                  city_id: l.city_id,
                  name: l.name,
                  cover_image: l.cover_image,
                  description: l.description || "",
                  type: l.type || "معلم سياحي",
                  is_popular: !!l.is_popular,
                  nearby_stations: Array.isArray(l.nearby_stations) ? l.nearby_stations : [],
                  images: Array.isArray(l.images) ? l.images : [l.cover_image],
                  activities: Array.isArray(l.activities) ? l.activities : [],
                }))
                : [],
            }));
            if (isMounted) {
              setFamousCities(mappedCities);
              saveStoredCities(mappedCities);
            }
          }

          const { data: dbPlaces, error } = await supabase.from("places").select("*, branches(*)");
          if (!error && dbPlaces && dbPlaces.length > 0) {
            currentPlaces = dbPlaces.map(mapDbPlaceToPlace);
          }

          const { data: dbBlogs, error: blogsErr } = await supabase
            .from("blogs")
            .select("id, title, slug, excerpt, category, created_at")
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(3);

          if (!blogsErr && dbBlogs && dbBlogs.length > 0) {
            const existingSlugs = new Set(dbBlogs.map((b: any) => b.slug || b.id));
            const remainingFallbacks = DEFAULT_HOME_BLOGS.filter(
              (b) => !existingSlugs.has(b.slug) && !existingSlugs.has(b.id)
            );
            const mergedBlogs = [...dbBlogs, ...remainingFallbacks].slice(0, 3);
            if (isMounted) {
              setHomeBlogs(mergedBlogs);
            }
          }
        }

        const counts: Record<string, number> = {};
        CATEGORIES_STRUCTURE.forEach(mainCat => {
          const subCatNames = new Set(mainCat.subCategories.map(s => s.name));
          const matchCount = currentPlaces.filter(place => {
            if (place.category === mainCat.name) return true;
            if (subCatNames.has(place.category)) return true;
            if (place.subCategories?.some(sub => subCatNames.has(sub))) return true;
            if (place.categoryLabel === mainCat.label) return true;
            return false;
          }).length;

          counts[mainCat.name] = matchCount;
        });

        if (isMounted) {
          setActivePlaces(currentPlaces);
          setPlacesCount(currentPlaces.length);
          setCategoryCounts(counts);
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    }

    fetchDynamicStats();
    return () => {
      isMounted = false;
      window.removeEventListener("cities_updated", handleCitiesUpdated);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.userAgent));
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable) &&
        target !== searchInputRef.current
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsDropdownOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const queryWords = getSearchWords(searchQuery);

  // فلترة خدمات الموقع المطابقة للبحث
  const matchedServices = searchQuery.trim() && queryWords.length > 0
    ? SITE_SERVICES.filter(service => {
      const serviceText = getSearchCleanedText([
        service.label,
        service.subtitle,
        ...service.keywords
      ].join(" "));

      return queryWords.every(word => serviceText.includes(word));
    })
    : [];

  // فلترة الأماكن والمحلات
  const matchedPlaces: Place[] = searchQuery.trim() && queryWords.length > 0
    ? activePlaces.filter(place => {
      const categoryLabels: Record<string, string> = {};
      CATEGORIES_STRUCTURE.forEach(main => {
        categoryLabels[main.name] = main.label;
        main.subCategories.forEach(sub => {
          categoryLabels[sub.name] = sub.label;
        });
      });

      const rawSearchableText = [
        place.name,
        place.name_en || "",
        place.categoryLabel,
        categoryLabels[place.category] || place.category,
        ...(place.subCategories || []).map(sc => categoryLabels[sc] || sc),
        place.place_type || "",
        place.city || "",
        place.governorate || "",
        place.briefLocation || "",
        place.fullAddress || "",
        place.description || "",
        place.category === "food_drinks" ? "اكل مشروبات مطعم مطاعم كافيه كافيهات مقهى قهاوي" : "",
        place.subCategories?.includes("restaurant") ? "مطعم مطاعم اكل" : "",
        place.subCategories?.includes("cafe") ? "كافيه كافيهات مقهى قهاوي مشروبات" : "",
        place.subCategories?.includes("pharmacy") ? "صيدلية صيدليات علاج دواء" : "",
        place.subCategories?.includes("hospital") ? "مستشفى مستشفيات عيادة مركز طبي صحة" : "",
        place.subCategories?.includes("park") ? "حديقة حدائق منتزه ملاهي اماكن عامة" : "",
      ].filter(Boolean).join(" ");

      const searchableText = getSearchCleanedText(rawSearchableText);

      return queryWords.every(word => searchableText.includes(word));
    }).slice(0, 5)
    : [];

  // فلترة الفئات
  const matchedCategories = searchQuery.trim() && queryWords.length > 0
    ? CATEGORIES_STRUCTURE.filter(cat => {
      const categorySearchable = getSearchCleanedText([
        cat.label,
        ...cat.subCategories.map(sub => sub.label)
      ].join(" "));

      return queryWords.every(word => categorySearchable.includes(word));
    }).slice(0, 3)
    : [];

  const hasResults = matchedServices.length > 0 || matchedPlaces.length > 0 || matchedCategories.length > 0;

  const handleSearchSubmit = (e: React.FormEvent, forceFullSearch: boolean = false) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (!forceFullSearch) {
      if (matchedServices && matchedServices.length > 0) {
        setIsDropdownOpen(false);
        router.push(matchedServices[0].href);
        return;
      }
      if (matchedPlaces && matchedPlaces.length === 1) {
        setIsDropdownOpen(false);
        router.push(`/places/${matchedPlaces[0].id}`);
        return;
      }
      if (matchedCategories && matchedCategories.length > 0) {
        setIsDropdownOpen(false);
        router.push(`/places?category=${encodeURIComponent(matchedCategories[0].name)}`);
        return;
      }
    }

    setIsDropdownOpen(true);
  };

  const quickSearchTags = [
    { label: "خريطة المترو", route: "/metro", icon: "metro.webp" },
    { label: "مونوريل العاصمة", route: "/monorail", icon: "Cairo_monorail_east.webp" },
    { label: "الأتوبيس الترددي BRT", route: "/brt", icon: "brt.webp" },
    { label: "القطار الكهربائي LRT", route: "/lrt", icon: "Cairo_lrt.webp" },
    { label: "سكك حديد مصر", route: "/railways", icon: "Cairo_train.webp" },
    { label: "مواقف السرفيس", route: "/microbus-stations", icon: "microbus.webp" },
    { label: "مواقف الأتوبيسات", route: "/bus-stations", icon: "bus.webp" },
    { label: "أحفظ مكاني (GPS)", route: "/save-location", icon: "cairo.webp" },
    { label: "دليل الهواتف والأكواد", route: "/directory", icon: "cairo.webp" },
    { label: "ازاي اروح؟", route: "/directions", icon: "arab_republic _of_egypt.webp" },
  ];

  const mainServices = [
    {
      id: "transit",
      title: "شبكات مترو القاهرة الكبرى",
      desc: "خرائط تفاعلية شاملة لخطوط مترو الأنفاق الثلاثة مع محطات التبادل ومسارات الانتقال السريعة.",
      icon: "metro",
      link: "/metro",
      badge: "النقل السريع",
    },
    {
      id: "save-location",
      title: "أحفظ مكاني (GPS دقيق)",
      desc: "سجّل موقعك الحالي أو مكان ركنتك بدقة تامة بالميلي مع حفظ التوقيت والرجوع عبر خرائط Google.",
      icon: "street",
      link: "/save-location",
      badge: "ميزة ذكية",
    },
    {
      id: "places",
      title: "دليل الأماكن والخدمات",
      desc: "استكشف المطاعم، العيادات، المحلات، والكافيهات مع مواعيد العمل، تقييمات الزوار، وأرقام التواصل.",
      icon: "restaurant",
      link: "/places",
      badge: "الدليل المحدث",
    },
    {
      id: "ai-planner",
      title: "مخطط الرحلات الذكي",
      desc: "صمّم برنامج خروجتك بالكامل بنقرة واحدة وفق ميزانيتك، عدد أفراد عائلتك، والمنطقة المفضلة.",
      icon: "robot",
      link: "/ai-planner",
      badge: "ذكاء اصطناعي",
    },
    {
      id: "directions",
      title: "دليل ازاي اروح والمواقف",
      desc: "خارطة طريق كاملة لأي مكان بمصر مع محطات الأتوبيس، السرفيس، القطارات، والمطارات.",
      icon: "egypt",
      link: "/directions",
      badge: "المسارات والمواقف",
    },
    {
      id: "directory",
      title: "دليل الهواتف والأكواد",
      desc: "أرقام الطوارئ، الخدمات الحكومية، وأكواد باقات وفليكسات شبكات المحمول المصرية.",
      icon: "phone",
      link: "/directory",
      badge: "أرقام وأكواد",
    },
    {
      id: "microbus-stations",
      title: "مواقف السرفيس والميكروباص",
      desc: "دليل تفصيلي لمواقف وخطوط السرفيس بين مناطق القاهرة الكبرى ومحافظات الوجهين البحري والقبلي.",
      icon: "microbus",
      link: "/microbus-stations",
      badge: "بين المحافظات",
    },
    {
      id: "blog",
      title: "مدونة وأدلة ماب القاهرة",
      desc: "أحدث المقالات الميدانية، نصائح الترانزيت، واقتراحات أماكن التنزه الهادئة والحيوية.",
      icon: "book",
      link: "/blog",
      badge: "أدلة وقصص",
    },
    {
      id: "propose",
      title: "إضافة واقتراح مكان جديد",
      desc: "هل تملك نشاطاً تجارياً أو تريد توثيق مكان جديد؟ أضف بياناتك مجاناً لتصل لآلاف الزوار يومياً.",
      icon: "store",
      link: "/propose-place",
      badge: "مجتمع الدليل",
    },
  ];

  const categoryCards = CATEGORIES_STRUCTURE;

  return (
    <main className={styles.mainWrapper}>
      {/* ── 1. HERO SECTION ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            دليل القاهرة الذكي — كل مكان وطريق ومواصلة بدقة متناهية
          </h1>

          <p className={styles.heroSubtitle}>
            منصتك المتكاملة لاستكشاف المطاعم والعيادات، شبكات المترو والمونوريل، خطوط المواصلات الحية، ودليل الهواتف وأرقام الطوارئ في مصر.
          </p>

          {/* Search Box */}
          <div ref={searchContainerRef} className={styles.searchBoxContainer}>
            <form onSubmit={(e) => handleSearchSubmit(e, false)}>
              <div className={`${styles.searchBar} ${isDropdownOpen && searchQuery.trim() ? styles.searchBarFocused : ""}`}>
                <FaSearch className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="ابحث عن محطة، مطعم، خدمة، أو كود شبكة..."
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className={styles.searchInput}
                  aria-label="ابحث في دليل ماب القاهرة"
                />
                <button
                  type="button"
                  onClick={() => {
                    searchInputRef.current?.focus();
                    setIsDropdownOpen(true);
                  }}
                  className={styles.shortcutBadge}
                  title="اضغط للتركيز على البحث"
                >
                  <kbd className={styles.shortcutKbd}>{isMac ? "⌘" : "Ctrl"}</kbd>
                  <span className={styles.shortcutPlus}>+</span>
                  <kbd className={styles.shortcutKbd}>K</kbd>
                </button>
              </div>
            </form>

            {/* Universal Live Search Dropdown */}
            {isDropdownOpen && searchQuery.trim().length > 0 && (
              <div className={styles.searchDropdown}>
                {/* 1. MATCHED SITE SERVICES */}
                {matchedServices.length > 0 && (
                  <div className={styles.dropdownSection}>
                    <div className={styles.dropdownSectionHeader}>
                      <FaLightbulb />
                      <span>خدمات وصفحات سريعة بالموقع</span>
                    </div>

                    {matchedServices.map((service) => (
                      <Link
                        key={service.id}
                        href={service.href}
                        onClick={() => setIsDropdownOpen(false)}
                        className={styles.dropdownItem}
                      >
                        <div className={styles.dropdownItemLeading}>
                          <Image
                            src={`/images/icons2d/${service.icon}`}
                            alt={service.label}
                            width={28}
                            height={28}
                            style={{ width: "28px", height: "28px", objectFit: "contain" }}
                          />
                          <div>
                            <div className={styles.dropdownItemTitle}>{service.label}</div>
                            <div className={styles.dropdownItemSubtitle}>{service.subtitle}</div>
                          </div>
                        </div>

                        <span className={styles.dropdownBadge}>
                          <span>انتقال</span>
                          <FaChevronLeft style={{ fontSize: "0.65rem" }} />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* 2. MATCHED PLACES */}
                {matchedPlaces.length > 0 && (
                  <div className={styles.dropdownSection}>
                    <div className={styles.dropdownSectionHeader} style={{ color: "var(--accent-secondary, #10b981)" }}>
                      <FaMapMarkerAlt />
                      <span>الأماكن المطابقة ({matchedPlaces.length})</span>
                    </div>

                    {matchedPlaces.map((place) => (
                      <Link
                        key={place.id}
                        href={`/places/${place.id}`}
                        onClick={() => setIsDropdownOpen(false)}
                        className={styles.dropdownItem}
                      >
                        <div className={styles.dropdownItemLeading}>
                          <Image
                            src={getMainCategoryImage(place.category, place.subCategories)}
                            alt={place.name}
                            width={28}
                            height={28}
                            style={{ width: "28px", height: "28px", objectFit: "contain" }}
                          />
                          <div>
                            <div className={styles.dropdownItemTitle}>
                              {place.name}
                              {place.name_en && (
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginRight: "6px", fontWeight: "normal" }}>
                                  ({place.name_en})
                                </span>
                              )}
                            </div>
                            <div className={styles.dropdownItemSubtitle}>
                              {place.categoryLabel} {place.briefLocation ? `• ${place.briefLocation}` : ""}
                            </div>
                          </div>
                        </div>
                        <FaChevronLeft style={{ fontSize: "0.75rem", color: "var(--text-muted)" }} />
                      </Link>
                    ))}
                  </div>
                )}

                {/* 3. MATCHED CATEGORIES */}
                {matchedCategories.length > 0 && (
                  <div className={styles.dropdownSection}>
                    <div className={styles.dropdownSectionHeader} style={{ color: "#eab308" }}>
                      <span>🗂️</span>
                      <span>الفئات والأنشطة</span>
                    </div>

                    <div className={styles.categoryPillGroup}>
                      {matchedCategories.map((cat) => (
                        <Link
                          key={cat.name}
                          href={`/places?category=${cat.name}`}
                          onClick={() => setIsDropdownOpen(false)}
                          className={styles.categoryPill}
                        >
                          <Image
                            src={`/images/icons3d/${cat.image}`}
                            alt={cat.label || cat.name}
                            width={18}
                            height={18}
                            style={{ width: "18px", height: "auto" }}
                          />
                          <span>{cat.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* NO RESULTS FALLBACK */}
                {!hasResults && (
                  <div className={styles.dropdownNoResults}>
                    <div style={{ fontSize: "2rem", marginBottom: "8px", color: "var(--text-muted)" }}>
                      <FaInbox />
                    </div>
                    <div style={{ fontWeight: "700", fontSize: "1rem", color: "var(--color-foreground)", marginBottom: "4px" }}>
                      عفواً، لا توجد نتائج مطابقة لـ &quot;{searchQuery}&quot;
                    </div>
                    <div style={{ fontSize: "0.85rem", marginBottom: "16px", color: "var(--text-secondary)" }}>
                      يمكنك تجربة الاستعانة بمخطط الرحلات الذكي أو اقتراح المكان لإضافته:
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "var(--color-foreground)",
                          fontSize: "0.85rem",
                          cursor: "pointer"
                        }}
                      >
                        مسح البحث
                      </button>
                      <Link
                        href="/ai-planner"
                        onClick={() => setIsDropdownOpen(false)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "8px",
                          backgroundColor: "#8b5cf6",
                          color: "#ffffff",
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          fontWeight: "700"
                        }}
                      >
                        مخطط الرحلات الذكي
                      </Link>
                      <Link
                        href="/propose-place"
                        onClick={() => setIsDropdownOpen(false)}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(0, 111, 238, 0.12)",
                          border: "1px solid var(--color-primary)",
                          color: "var(--color-primary)",
                          fontSize: "0.85rem",
                          textDecoration: "none",
                          fontWeight: "700"
                        }}
                      >
                        اقتراح مكان جديد
                      </Link>
                    </div>
                  </div>
                )}

                {/* 4. FULL SEARCH BUTTON */}
                <button
                  type="button"
                  onClick={(e) => handleSearchSubmit(e, true)}
                  className={styles.dropdownFullSearchBtn}
                >
                  <FaSearch style={{ fontSize: "0.85rem" }} />
                  <span>عرض كافة النتائج لـ &quot;{searchQuery}&quot;</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick tags */}
          <div className={styles.quickTagsList}>
            {quickSearchTags.map((tag, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (tag.route) {
                    router.push(tag.route);
                  }
                }}
                className={styles.quickTagChip}
              >
                <Image
                  src={`/images/icons2d/${tag.icon}`}
                  alt={tag.label}
                  width={18}
                  height={18}
                  style={{ width: "18px", height: "18px", objectFit: "contain" }}
                />
                <span>{tag.label}</span>
              </button>
            ))}
          </div>

          {/* Cairo Weather & Comfort Tip Widget */}
          <div className={styles.weatherWidgetWrapper}>
            <WeatherComfortWidget />
          </div>

          {/* Sponsored Ad Slider Banner */}
          <div className={styles.adSliderWrapper}>
            <AdSlider />
          </div>
        </div>
      </section>

      {/* ── 2. FAMOUS CITIES SECTION (المدن الشهيرة) ── */}
      <section className={styles.citiesSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>مدن ومعالم مصر الشهيرة</h2>
          <p className={styles.sectionSubtitle}>
            استكشف المدن السياحية والحيوية ومعالمها القريبة مع تفاصيل الطقس وأهم المحطات.
          </p>
        </div>

        {/* Horizontal Slider Track */}
        <div
          ref={citiesScrollRef}
          onScroll={handleCitiesScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={styles.citiesSliderTrack}
          style={{ cursor: isMouseDown ? "grabbing" : "grab" }}
        >
          {famousCities.map((city) => (
            <div
              key={city.id}
              onClick={() => {
                if (!dragMoved) {
                  setSelectedCityModal(city);
                }
              }}
              className={styles.cityCard}
              role="button"
              tabIndex={0}
              aria-label={`عرض تفاصيل مدينة ${city.name}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedCityModal(city);
                }
              }}
            >
              <img
                src={city.cover_image}
                alt={city.name}
                draggable={false}
                className={styles.cityCardImage}
              />
              <div className={styles.cityCardScrim} />
              <div className={styles.cityCardBody}>
                <h3 className={styles.cityCardName}>{city.name}</h3>
                {city.landmarks && city.landmarks.length > 0 && (
                  <span className={styles.cityCardMeta}>
                    <FaMapMarkerAlt style={{ fontSize: "0.7rem", color: "var(--color-primary)" }} />
                    <span>{city.landmarks.length} معالم مسجلة</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Navigation Arrows & Indicators */}
        {famousCities.length > 1 && (
          <div className={styles.sliderControls}>
            <button
              onClick={scrollPrev}
              type="button"
              disabled={!canScrollPrev}
              className={styles.sliderArrowBtn}
              aria-label="المدينة السابقة"
            >
              <FaChevronRight style={{ fontSize: "0.85rem" }} />
            </button>

            <div className={styles.sliderDotsGroup}>
              {famousCities.map((_, idx) => {
                const activeIndex = Math.min(
                  famousCities.length - 1,
                  Math.max(0, Math.round(citiesScrollProgress * (famousCities.length - 1)))
                );
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => scrollToCity(idx)}
                    type="button"
                    className={`${styles.sliderDot} ${isActive ? styles.sliderDotActive : styles.sliderDotInactive}`}
                    aria-label={`الذهاب إلى المدينة ${idx + 1}`}
                  />
                );
              })}
            </div>

            <button
              onClick={scrollNext}
              type="button"
              disabled={!canScrollNext}
              className={styles.sliderArrowBtn}
              aria-label="المدينة التالية"
            >
              <FaChevronLeft style={{ fontSize: "0.85rem" }} />
            </button>
          </div>
        )}
      </section>

      {/* ── 3. MAIN SERVICES GRID (منظومة خدمات القاهرة) ── */}
      <section className={styles.servicesSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>منظومة خدمات القاهرة والمواصلات</h2>
          <p className={styles.sectionSubtitle}>
            وصول سريع ومباشر لأدق تفاصيل النقل، أرقام الخدمات، وأدوات التنقل الذكية في العاصمة.
          </p>
        </div>

        <div className={styles.servicesGrid}>
          {mainServices.map((service) => (
            <Link
              key={service.id}
              href={service.link}
              className={styles.serviceCard}
            >
              <div>
                <div className={styles.serviceCardTop}>
                  <div className={styles.serviceCardIconWrapper}>
                    <Image
                      src={`/images/icons3d/${service.icon}.png`}
                      alt={service.title}
                      width={44}
                      height={44}
                      style={{ width: "44px", height: "auto" }}
                    />
                  </div>
                  {service.badge && (
                    <span className={styles.serviceCardBadge}>{service.badge}</span>
                  )}
                </div>

                <h3 className={styles.serviceCardTitle}>{service.title}</h3>
                <p className={styles.serviceCardDesc}>{service.desc}</p>
              </div>

              <div className={styles.serviceCardAction}>
                <span>الانتقال للخدمة</span>
                <FaArrowLeft style={{ fontSize: "0.8rem" }} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 4. BROWSE BY CATEGORY PREVIEW (تصفح حسب الفئة) ── */}
      <section className={styles.categorySection}>
        <div className={styles.categoryContainer}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>تصفّح حسب الفئة في دليل الأماكن</h2>
            <p className={styles.sectionSubtitle}>
              اختر الفئة للاطلاع على المواعيد، الفروع، وأرقام الهواتف المعتمدة.
            </p>
          </div>

          <div className={styles.categoryGrid}>
            {categoryCards.map((cat) => (
              <Link
                key={cat.name}
                href={`/places?category=${cat.name}`}
                className={styles.categoryTile}
              >
                <div className={styles.categoryTileIcon}>
                  <Image
                    src={`/images/icons3d/${cat.image}`}
                    alt={cat.label}
                    width={36}
                    height={36}
                    style={{ width: "36px", height: "auto" }}
                  />
                </div>
                <div>
                  <h4 className={styles.categoryTileTitle}>{cat.label}</h4>
                  <span className={styles.categoryTileCount}>
                    {categoryCounts[cat.name] || 0} مكان
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. BLOG & ARTICLES PREVIEW SECTION (المدونة) ── */}
      <section className={styles.blogSection}>
        <div className={styles.blogHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle} style={{ textAlign: "right" }}>
              مدونة ومقالات خريطة القاهرة
            </h2>
            <p className={styles.sectionSubtitle} style={{ textAlign: "right", margin: 0 }}>
              أحدث نصائح الترانزيت، خطوط السفر اليومية، وأفضل أماكن الخروج المحدثة.
            </p>
          </div>

          <Link href="/blog" className={styles.browseAllBlogBtn}>
            <span>تصفح جميع المقالات</span>
            <FaArrowLeft style={{ fontSize: "0.8rem" }} />
          </Link>
        </div>

        <div className={styles.blogArticlesGrid}>
          {homeBlogs.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${encodeURIComponent(post.slug || post.id)}`}
              className={styles.blogCard}
            >
              <div>
                <span className={styles.blogCardCategory}>
                  {post.category || "مقالات خريطة القاهرة"}
                </span>
                <h3 className={styles.blogCardTitle}>{post.title}</h3>
                {post.excerpt && (
                  <p className={styles.blogCardExcerpt}>{post.excerpt}</p>
                )}
              </div>
              <span className={styles.blogCardAction}>
                <span>قراءة المقال</span>
                <FaChevronLeft style={{ fontSize: "0.7rem" }} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 6. AI PLANNER SPOTLIGHT (مخطط الرحلات الذكي) ── */}
      <section className={styles.aiSection}>
        <div className={styles.aiContainer}>
          <div className={styles.aiRobotIcon}>
            <Image
              src="/images/icons3d/robot.webp"
              alt="الذكاء الاصطناعي لماب القاهرة"
              width={72}
              height={72}
              style={{ width: "72px", height: "auto" }}
            />
          </div>

          <h2 className={styles.aiTitle}>
            محتار تخرج فين النهاردة؟ اترك التخطيط للذكاء الاصطناعي!
          </h2>
          <p className={styles.aiSubtitle}>
            حدد ميزانيتك، عدد الأفراد، والمنطقة المفضلة، وسيقوم المساعد الذكي بتنسيق برنامج يومك بالكامل مع أفضل المطاعم والكافيهات والمواصلات المناسبة.
          </p>

          <Link href="/ai-planner" className={styles.aiCtaBtn}>
            <span>جرب مخطط الرحلات الذكي مجاناً</span>
            <FaArrowLeft style={{ fontSize: "0.85rem" }} />
          </Link>
        </div>
      </section>

      {/* ── 7. PROPOSE PLACE CTA (إضافة مكان جديد) ── */}
      <section className={styles.proposeSection}>
        <h2 className={styles.proposeTitle}>
          هل تملك نشاطاً تجارياً أو تريد إضافة مكان جديد؟
        </h2>
        <p className={styles.proposeSubtitle}>
          ساهم معنا في إثراء دليل ماب القاهرة وأضف نشاطك أو مكانك المفضّل مجاناً ليصل إلى آلاف الزوار والمهتمين يومياً.
        </p>
        <Link href="/propose-place" className={styles.proposeCtaBtn}>
          <FaPlusCircle />
          <span>اقتراح أو إضافة مكان جديد</span>
        </Link>
      </section>

      {/* City Detail Modal */}
      {selectedCityModal && (
        <CityDetailModal
          city={selectedCityModal}
          onClose={() => setSelectedCityModal(null)}
        />
      )}
    </main>
  );
}
