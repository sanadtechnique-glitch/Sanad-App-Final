import { db, serviceProvidersTable } from "@workspace/db";

const providers = [
  // Restaurants
  { name: "Al Medina Restaurant", nameAr: "مطعم المدينة", category: "restaurant" as const, description: "Authentic Tunisian cuisine with traditional dishes", descriptionAr: "مطبخ تونسي أصيل مع أطباق تقليدية", address: "شارع الحبيب بورقيبة، بن قردان", rating: 4.8, isAvailable: true },
  { name: "Gulf Palace", nameAr: "قصر الخليج", category: "restaurant" as const, description: "Grilled meats and seafood specialties", descriptionAr: "مشويات ومأكولات بحرية مميزة", address: "الشارع الرئيسي، بن قردان", rating: 4.5, isAvailable: true },
  // Pharmacies
  { name: "Al Shifa Pharmacy", nameAr: "صيدلية الشفاء", category: "pharmacy" as const, description: "Full-service pharmacy with prescription drugs and health products", descriptionAr: "صيدلية متكاملة بالأدوية والمستلزمات الصحية", address: "حي النور، بن قردان", rating: 4.7, isAvailable: true },
  { name: "Modern Pharmacy", nameAr: "الصيدلية الحديثة", category: "pharmacy" as const, description: "Modern pharmacy with wide selection of medicines", descriptionAr: "صيدلية عصرية بتشكيلة واسعة من الأدوية", address: "المركز التجاري، بن قردان", rating: 4.4, isAvailable: true },
  // Lawyers
  { name: "Habib Legal Office", nameAr: "مكتب حبيب للمحاماة", category: "lawyer" as const, description: "Expert legal advice for civil and commercial cases", descriptionAr: "استشارات قانونية متخصصة في القضايا المدنية والتجارية", address: "شارع الحرية، بن قردان", rating: 4.9, isAvailable: true },
  { name: "Justice Law Firm", nameAr: "مكتب العدالة", category: "lawyer" as const, description: "Full legal representation and document services", descriptionAr: "تمثيل قانوني متكامل وخدمات التوثيق", address: "المركز الإداري، بن قردان", rating: 4.6, isAvailable: false },
  // Groceries
  { name: "Al Baraka Market", nameAr: "سوق البركة", category: "grocery" as const, description: "Fresh produce, groceries and daily essentials", descriptionAr: "منتجات طازجة والمواد الغذائية والضروريات اليومية", address: "السوق الكبير، بن قردان", rating: 4.3, isAvailable: true },
  { name: "City Supermarket", nameAr: "سوبرماركت المدينة", category: "grocery" as const, description: "Large supermarket with all household products", descriptionAr: "سوبرماركت كبير بجميع منتجات المنزل", address: "شارع الاستقلال، بن قردان", rating: 4.5, isAvailable: true },
  // Mechanics
  { name: "Al Amin Garage", nameAr: "كراج الأمين", category: "mechanic" as const, description: "Expert auto repair and maintenance services", descriptionAr: "خدمات إصلاح وصيانة السيارات المتخصصة", address: "المنطقة الصناعية، بن قردان", rating: 4.6, isAvailable: true },
  { name: "Quick Fix Auto", nameAr: "الإصلاح السريع", category: "mechanic" as const, description: "Fast and reliable car repair services", descriptionAr: "خدمات إصلاح سيارات سريعة وموثوقة", address: "طريق المطار، بن قردان", rating: 4.4, isAvailable: true },
  // Doctors
  { name: "Dr. Ali Ben Salah Clinic", nameAr: "عيادة د. علي بن صالح", category: "doctor" as const, description: "General medicine and primary healthcare", descriptionAr: "طب عام ورعاية صحية أولية", address: "شارع الصحة، بن قردان", rating: 4.8, isAvailable: true },
  { name: "Family Health Center", nameAr: "مركز صحة الأسرة", category: "doctor" as const, description: "Comprehensive family healthcare and pediatrics", descriptionAr: "رعاية صحية متكاملة للأسرة وطب الأطفال", address: "حي الزيتونة، بن قردان", rating: 4.7, isAvailable: true },
];

async function seed() {
  console.log("Seeding service providers...");
  
  const existing = await db.select().from(serviceProvidersTable);
  if (existing.length > 0) {
    console.log(`Database already has ${existing.length} providers. Skipping seed.`);
    process.exit(0);
  }

  await db.insert(serviceProvidersTable).values(providers);
  console.log(`Seeded ${providers.length} service providers.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
