const stats = [
  { value: "25+", label: "Yıllık Deneyim" },
  { value: "500+", label: "Tamamlanan Proje" },
  { value: "150+", label: "Mutlu Müşteri" },
  { value: "50+", label: "Uzman Personel" },
  { value: "99.8%", label: "Kalite Oranı" },
  { value: "24/7", label: "Teknik Destek" }
];

export const Stats = () => {
  return (
    <section className="py-24 bg-navy-light hidden">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">RAKAMLARLA BİZ</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Başarılarımız Rakamlarla</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Yılların deneyimi ve müşteri memnuniyeti odaklı çalışmamızın sonuçları
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-5xl font-bold text-primary mb-2">{stat.value}</div>
              <div className="text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
