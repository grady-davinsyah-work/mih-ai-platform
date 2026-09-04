/*
 * Data statis landpage Portal PMP — diekstrak dari PMP Portal.html
 * (save-page dari https://tokogd.com/web-pmp.html).
 *
 * Ruling: nama field unit mempertahankan nama asli file HTML
 * (profilPimpinanId, tugasUnitKerjaId, fungsiUnitKerjaId) karena
 * berisi HTML mentah yang dirender via dangerouslySetInnerHTML.
 * Field `image` unit adalah kunci ke `portalImages`, bukan URL.
 */

export interface Unit {
  slug: string;
  name: string;
  head: string;
  position: string;
  email: string;
  image: string;
  profilPimpinanId: string;
  tugasUnitKerjaId: string;
  fungsiUnitKerjaId: string;
}

export interface News {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  author: string;
  date: string;
  gallery: string[];
  content: string;
}

export interface Publication {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  author: string;
  date: string;
  documentUrl: string;
  documentName: string;
  content: string;
}

export interface ServiceDoc {
  type: "pdf" | "image";
  title: string;
  url: string;
}

export interface Service {
  slug: string;
  name: string;
  description: string;
  documents: ServiceDoc[];
}

export interface DashboardLink {
  slug: string;
  title: string;
  url: string;
  status: "public" | "private";
}

export interface PortalMenuItem {
  name: string;
  path?: string;
  status: "public" | "private";
  children?: { name: string; path: string }[];
}

export interface ExternalLink {
  name: string;
  url: string;
  label: string;
  status: "public" | "private";
}

/* ===== Data mentah dari file HTML (field nama asli) ===== */
    const services = [
      {
        slug: "pelayanan-pendampingan-pengalokasian-anggaran-bagi-kementerian-lembaga",
        name: "Pelayanan Pendampingan Pengalokasian Anggaran bagi Kementerian/Lembaga",
        description: "Diberikan kepada Kementerian/Lembaga (K/L) dalam menyusun perencanaan dan pengalokasian anggaran.​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      },
      {
        slug: "konsultasi-arah-kebijakan-nasional-bagi-sektor-di-daerah",
        name: "Konsultasi Arah Kebijakan Nasional bagi Sektor di Daerah",
        description: "Diberikan kepada Pemerintah Daerah/Masyarakat umum/Mahasiswa/Lembaga Non-Pemerintah/Organisasi Masyarakat dalam penyusunan perencanaan Pembangunan daerah agar dapat selaras dengan kebijakan nasional.​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      },
      {
        slug: "konsultasi-dokumen-perencanaan-nasional-dan-daerah",
        name: "Konsultasi Dokumen Perencanaan Nasional dan Daerah​",
        description: "Jenis layanan ini merupakan pelayanan yang diberikan kepada Kementerian/Lembaga/Pemerintah Daerah/DPRD dalam rangka menyusun atau menyesuaikan dokumen perencanaan nasional dan daerah, yang mencakup Rencana Strategis (Renstra) dan Rencana Kerja (Renja) K/L, serta Rencana Pembangunan Jangka Menengah Daerah (RPJMD) dan Rencana Kerja Pemerintah Daerah (RKPD) Provinsi/Kabupaten/Kota, termasuk penyelarasannya dengan Rencana Pembangunan Jangka Menengah Nasional (RPJMN).​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      },
      {
        slug: "fasilitasi-pendampingan-perencanaan-pembangunan-nasional",
        name: "Fasilitasi Pendampingan Perencanaan Pembangunan Nasional​",
        description: "Jenis layanan ini merupakan layanan yang diberikan kepada Kementerian/Lembaga, Pemerintah Daerah, DPRD, masyarakat umum, mahasiswa, lembaga nonpemerintah, dan organisasi masyarakat, khususnya dalam rangka mendukung pemahaman serta penjabaran teknis dan substantif mengenai keterkaitan perencanaan pembangunan di tingkat pusat dan daerah.​​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      },
      {
        slug: "fasilitasi-penyusunan-model-model-pembangunan",
        name: "Fasilitasi Penyusunan Model-Model Pembangunan​​",
        description: "Jenis layanan ini merupakan layanan yang diberikan kepada Kementerian/Lembaga, Pemerintah Daerah, DPRD, masyarakat umum, mahasiswa, lembaga nonpemerintah, dan organisasi masyarakat dalam rangka meningkatkan pemahaman mengenai pengembangan inovasi di bidang perencanaan pembangunan.​​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      },
      {
        slug: "fasilitasi-penyusunan-rencana-akse-percepatan-pembangunan-nasional",
        name: "Fasilitasi Penyusunan Rencana Aksi Percepatan Pembangunan Nasional​​",
        description: "Jenis layanan ini merupakan layanan yang diberikan kepada Pemerintah Daerah, DPRD, masyarakat umum, mahasiswa, lembaga nonpemerintah, dan organisasi masyarakat dalam rangka mendukung perumusan kerangka hingga pemantauan rencana aksi pelaksanaan kegiatan percepatan pembangunan nasional, termasuk upaya mengidentifikasi dan mengatasi hambatan (debottlenecking) dalam pelaksanaan pembangunan nasional.​​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      },
      {
        slug: "fasilitasi-kegiatan-tematis-perencanaan-pembangunan-nasional",
        name: "Fasilitasi Kegiatan Tematis Perencanaan Pembangunan Nasional​​",
        description: "Jenis layanan ini merupakan layanan yang diberikan kepada Pemerintah Daerah, DPRD, masyarakat umum, mahasiswa, lembaga nonpemerintah, dan organisasi masyarakat dalam rangka mendukung penyusunan perencanaan pembangunan berbasis tema tertentu agar selaras dengan prioritas pembangunan nasional.​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      },
      {
        slug: "fasilitasi-pendampingan-perhitungan-indikator-tematik",
        name: "Fasilitasi Pendampingan Perhitungan Indikator Tematik​​",
        description: "Jenis layanan ini merupakan layanan yang diberikan kepada Pemerintah Daerah, DPRD, masyarakat umum, mahasiswa, lembaga nonpemerintah, dan organisasi masyarakat dalam rangka mendukung penyusunan dan perhitungan indikator tematik, seperti Blue Economy, GRK, IMD, dan indikator tematik lainnya dalam perencanaan pembangunan nasional.​​",
        documents: [
          { type: "image", title: "Alur Pelayanan Publik", url: "https://drive.google.com/thumbnail?id=1B_Wr3aqEIJs5XeVqDaldCYMUAMDPv-Kz&sz=w2000" },
          { type: "image", title: "Survei Kepuasan Masyarakat", url: "https://drive.google.com/thumbnail?id=1vH6KnNu1cFhW1HdU5ieWfjA8lHZzPLvG&sz=w2000" }
        ]
      }
    ];
    const news = [
      {
        slug: "kunjungan-lapangan-dan-rapat-kerja-kedeputian-perencanaan-makro-pembangunan",
        title: "Kunjungan Lapangan dan Rapat Kerja Kedeputian Perencanaan Makro Pembangunan",
        excerpt: "Perencanaan pembangunan tidak cukup hanya di atas meja. Melalui kunjungan lapangan di Kabupaten Banyumas, Kedeputian Perencanaan Makro Pembangunan belajar langsung dari kondisi, pengalaman, dan praktik di lapangan untuk menghadirkan kebijakan yang lebih relevan dan berdampak.",
        image: "https://drive.google.com/thumbnail?id=1uPQFImcaL8s-ntlASfxKUfRMrpju-a5R&sz=w2000",
        category: "PMP",
        author: "Admin PMP",
        date: "8 Agustus 2026",
        gallery:[
          "https://drive.google.com/thumbnail?id=1BLJe_OXsPnssrhHm46YvRohUwv168mbL&sz=w2000",
          "https://drive.google.com/thumbnail?id=1x6_-8WjWyBajJuqH4kRUSbzT6hXfRy0F&sz=w2000",
          "https://drive.google.com/thumbnail?id=1W9Gxvqoh5xXkODIgjLgzU_4xHMe8KirF&sz=w2000",
          "https://drive.google.com/thumbnail?id=1DCLg-hNfUeaNfzZb-x3onj-i6WrMYfU_&sz=w2000",
          "https://drive.google.com/thumbnail?id=12raxenKEGtzjbaJyHJUF8NpXMFnLt7AF&sz=w2000",
          "https://drive.google.com/thumbnail?id=11Xu-jxdt14oT4lleUpvns6Aac72CeoBO&sz=w2000",
          "https://drive.google.com/thumbnail?id=1pYGj2Pnr0JUJjTsljoI-5f2MfyT-qV9G&sz=w2000"
        ],
        content: "<p>Perencanaan pembangunan tidak cukup hanya disusun dari balik meja. Di Kabupaten Banyumas, Kedeputian Perencanaan Makro Pembangunan melihat langsung sejumlah praktik dan inovasi pembangunan di lapangan, kemudian berdiskusi dengan pemerintah daerah, akademisi, pakar, dan praktisi di Universitas Jenderal Soedirman.</p><p>Berbagai praktik, tantangan, dan pengalaman yang ditemui menjadi bahan refleksi dalam mengawal target pembangunan ke depan, sekaligus melihat kembali perjalanan perencanaan ekonomi Bappenas dari masa ke masa.</p>"
      },{
        slug: "kickoff-tim-pelaksana-pmo-bali",
        title: "Kick Off Tim Pelaksana PMO Bali",
        excerpt: "Kementerian PPN/Bappenas bersama Pemerintah Provinsi Bali memulai operasional Tim Pelaksana Transformasi Kerthi Bali untuk memperkuat koordinasi lintas sektor dan mengawal implementasi Peta Jalan Transformasi Ekonomi Kerthi Bali.",
        image: "https://drive.google.com/thumbnail?id=1bxXGOaXglPErkf7uBhgAxJ2-n86BkS1g&sz=w2000",
        category: "PMO",
        author: "Admin PMP",
        date: "25 Juni 2026",
        gallery:[
          "https://drive.google.com/thumbnail?id=1bxXGOaXglPErkf7uBhgAxJ2-n86BkS1g&sz=w2000",
          "https://drive.google.com/thumbnail?id=1bXbokproUqzqG70TUd6gHm6aUcbAJ-UO&sz=w2000",
          "https://drive.google.com/thumbnail?id=1_NFhOUfmqSDIBXuhvQXKzLQkgjYTgkAg&sz=w2000",
          "https://drive.google.com/thumbnail?id=1nrhh8kgQj-8AD9YUiJh7spxvrAmuz3cg&sz=w2000"
        ],
        content: "<p>Sebagai tindak lanjut Keputusan Menteri PPN/Kepala Bappenas Nomor 51/M.PPN/HK/05/2026 tentang Pembentukan Tim Koordinasi Pelaksanaan Transformasi Kerthi Bali, Kementerian PPN/Bappenas bersama Pemerintah Provinsi Bali menyelenggarakan Kick Off Tim Pelaksana Transformasi Kerthi Bali pada 25–26 Juni 2026. Kegiatan ini bertujuan mengoperasionalkan Tim Pelaksana sekaligus menyelaraskan pemahaman para pemangku kepentingan dalam mengawal implementasi Peta Jalan Transformasi Ekonomi Kerthi Bali.</p><p>Dalam kegiatan tersebut disepakati penguatan peran Sekretariat Transformasi Kerthi Bali (STKB) sebagai platform kolaborasi pemerintah pusat dan daerah yang berfokus pada koordinasi lintas sektor, fasilitasi penyelesaian hambatan, monitoring dan evaluasi, serta penguatan pembiayaan pembangunan. STKB berperan mengawal proyek-proyek transformasi tanpa mengambil alih fungsi Bappenas, Bappeda, maupun perangkat daerah. Selain itu, diskusi penjaringan isu strategis bersama perangkat daerah menghasilkan sejumlah isu prioritas yang akan menjadi dasar penyusunan rencana kerja dan penetapan prioritas pengawalan proyek transformasi.</p><p>Kegiatan ini juga mencakup pembahasan internal mengenai pengelolaan sekretariat transformasi di daerah, yang meliputi aspek kelembagaan dan tata kelola, seperti penetapan lokasi sekretariat, mekanisme koordinasi, penyempurnaan Manual Book STKB, skema penugasan sumber daya manusia, serta rencana operasional sekretariat. Hasil pembahasan tersebut menjadi landasan untuk memastikan STKB memiliki tata kelola yang jelas, mekanisme kerja yang efektif, dan kesiapan kelembagaan dalam mendukung implementasi Transformasi Kerthi Bali secara berkelanjutan.</p>"
      },
      {
        slug: "bappenas-dorong-hilirisasi-dan-produktivitas-di-imf-world-bank-spring-meetings-2026",
        title: "Bappenas–EDS16 World Bank Bahas Penguatan Hilirisasi Industri di IMF–WBG",
        excerpt: "Kementerian PPN/Bappenas bersama Office of Executive Director for the Southeast Asia Voting Group (EDS16) World Bank Group menyelenggarakan side event pada IMF–World Bank Spring Meetings 2026 untuk mendorong hilirisasi, peningkatan produktivitas, dan transformasi struktural sebagai strategi menghadapi ketidakpastian global. Forum tersebut menghasilkan empat rekomendasi utama bagi negara berkembang, yakni penguatan industri bernilai tambah, pendekatan pembangunan yang holistik, kolaborasi dengan lembaga internasional, serta penguatan ekosistem perencanaan pembangunan dan kualitas SDM.",
        image: "https://drive.google.com/thumbnail?id=1rglEUbJQNG3CSAEO3fAQqTw9AWm_THkH&sz=w2000",
        category: "Hilirisasi",
        author: "Admin PMP",
        date: "16 April 2026",
        gallery:[
          "https://drive.google.com/thumbnail?id=1LYQwWjaYH7D9FROYuypTDCNHvFOSsicL&sz=w2000",
          "https://drive.google.com/thumbnail?id=1WLWDFnUFwa_G_a58h4ep1f5YLdk9hj4M&sz=w2000",
          "https://drive.google.com/thumbnail?id=11KOiSFjTmC0JvNUpgBB8Vjd2hiKaBjR3&sz=w2000"
        ],
        content: "<p>Kementerian PPN/Bappenas bersama Office of Executive Director for the Southeast Asia Voting Group (EDS16) World Bank Group menggelar side event “Navigating Through Global Volatilities: Job and Productivity-led Pathways to Strong and Sustainable Growth in Emerging Economies” pada rangkaian International Monetary Fund-World Bank Group Spring Meetings (IMF-WBG) di Washington D.C., Amerika Serikat, pada 13–18 April 2026.</p><p>Forum ini menjadi wadah bagi Indonesia untuk menyuarakan pentingnya hilirisasi dan peningkatan produktivitas sebagai strategi negara berkembang dalam menghadapi ketidakpastian ekonomi dan politik global.</p><p>“Pertumbuhan ekonomi di negara-negara berkembang, termasuk Indonesia selama ini lebih banyak didorong oleh akumulasi modal (capital) dan tenaga kerja (labor) daripada oleh inovasi atau efisiensi teknologi,” ujar Deputi Bidang Perencanaan Makro Pembangunan Kementerian PPN/Bappenas Eka Chandra Buana, Kamis (16/4).</p><p>Diskusi dalam side event tersebut menyoroti tantangan yang dihadapi negara berkembang untuk mempertahankan pertumbuhan ekonomi yang kuat dan stabil, akibat volatilitas global, mulai dari ketegangan geopolitik, fragmentasi perdagangan, pengetatan keuangan, hingga dampak perubahan iklim. Indonesia menyampaikan pentingnya transformasi struktural melalui peralihan dari ekspor bahan mentah menuju industri bernilai tambah tinggi berbasis sumber daya alam, penguasaan teknologi, serta penguatan kapasitas sumber daya manusia.</p><p>Dialog yang dihadiri para ahli dari World Bank Group, ADB, OECD, dan akademisi ini memberikan berbagai perspektif strategis, meliputi upaya menghadapi tantangan ketenagakerjaan global, pentingnya digitalisasi, penguatan hilirisasi, hingga penguatan peran diaspora untuk mendukung pendidikan. Direktur Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan Kementerian PPN/Bappenas Ibnu Yahya menuturkan bahwa sektor usaha di Indonesia saat ini masih menghadapi kesenjangan terhadap akses pembiayaan dan penguasaan teknologi, terutama pada usaha berskala kecil yang tumbuh akibat hilangnya pekerjaan di sektor formal.</p><p>Kegiatan ini menghasilkan empat pesan utama bagi negara berkembang dalam menghadapi kondisi ketidakpastian global saat ini. Pertama, transformasi ke industri bernilai tambah tinggi. Kedua, menggunakan pendekatan pembangunan yang holistik. Ketiga, memperkuat kolaborasi dengan lembaga internasional, seperti Bank Dunia, OECD, dan ADB, untuk meningkatkan kapasitas pengetahuan dan menentukan instrumen pembiayaan pembangunan. Terakhir, menciptakan ekosistem perencanaan pembangunan yang didukung lembaga think-tank dan peningkatan kualitas pendidikan terkait perencanaan pembangunan.</p><p>“Untuk keluar dari jebakan negara berpendapatan menengah diperlukan pendekatan yang holistik, di mana stabilitas makroekonomi harus berjalan selaras dengan kebijakan industri yang tepat sasaran, pengembangan keterampilan yang berkelanjutan, dan dinamika bisnis yang dinamis,” tutup Deputi Chandra.</p>"
      },
      {
        slug: "bappenas-tekankan-sinkronisasi-pusat-daerah-sebagai-kunci-pemerataan-pembangunan",
        title: "Bappenas Tekankan Sinkronisasi Pusat–Daerah sebagai Kunci Pemerataan Pembangunan",
        excerpt: "Deputi Bidang Perencanaan Makro Pembangunan Kementerian PPN/Bappenas Eka Chandra Buana menegaskan bahwa pemerataan pembangunan nasional diwujudkan melalui perencanaan yang terkoordinasi antara pemerintah pusat dan daerah dengan kebijakan yang disesuaikan dengan karakteristik serta kebutuhan masing-masing wilayah.",
        image: "https://drive.google.com/thumbnail?id=1a-xBTl5MbBwaR_aNmB02echYmb26tCJs&sz=w2000",
        category: "Pemerataan Pembangunan",
        author: "Admin PMP",
        date: "27 Januari 2026",
        gallery:[
          "https://drive.google.com/thumbnail?id=1h3Eg57k7l8EfomFM46scamqVr6qnAPTT&sz=w2000"
        ],
        content: "<p>Deputi Bidang Perencanaan Makro Pembangunan Kementerian PPN/Bappenas Eka Chandra Buana menyampaikan bahwa pemerataan pembangunan nasional memerlukan perencanaan yang terkoordinasi antara pemerintah pusat dan daerah, dengan pendekatan yang menyesuaikan karakteristik serta kebutuhan masing-masing wilayah. “Keadilan pembangunan tidak berarti menyeragamkan kebijakan, melainkan memastikan setiap daerah berkembang sesuai potensinya. Sejak tahap perencanaan, arah pembangunan nasional telah diturunkan hingga ke level daerah dan disinkronkan dengan pemerintah daerah melalui koordinasi bersama Kementerian Dalam Negeri,” tegas Deputi Chandra dalam Podcast Bappenas, Selasa (27/1).</p><p>Dalam episode podcast yang membahas mekanisme pemerataan pembangunan dan implementasi kebijakan ke depan ini, Deputi Chandra juga menyampaikan bahwa dalam penyusunan Rencana Pembangunan Jangka Panjang Nasional (RPJPN) 2025–2045, pemerintah daerah juga diminta menyusun rencana jangka panjang daerah yang selaras dengan target nasional.</p><p>“Di dalam rencana pembangunan jangka panjang itu ada indikator-indikator yang ditetapkan secara nasional. Nah, itu kita turunkan ke daerah, tanpa menegasikan karakteristik atau keunikan daerah,” jelas Deputi Chandra.</p><p>Setiap wilayah memiliki fokus pembangunan yang berbeda. Bali, misalnya, memiliki kekuatan utama di sektor pariwisata, sementara wilayah seperti Jawa Barat atau Jawa Tengah lebih bertumpu pada sektor industri. Perbedaan tersebut menjadi dasar penyusunan kebijakan yang spesifik wilayah, bukan untuk disamakan. Prinsip ini juga diperkuat melalui Surat Perjanjian Bersama antara Kementerian PPN/Bappenas dan Kementerian Dalam Negeri dalam proses sinkronisasi perencanaan.</p><p>Deputi Chandra menegaskan bahwa pemerataan tidak identik dengan pembagian yang sama rata. “Kita tidak bisa one size fits all kebijakan. Kebijakan antara Papua dan Jawa tentu berbeda, fokusnya juga berbeda sesuai dengan kebutuhannya. Keadilan pembangunan itu dicapai melalui intervensi yang proporsional berdasarkan tingkat kebutuhan masing-masing wilayah,” ujar Deputi Chandra.</p><p>Dalam tahap implementasi, Kementerian PPN/Bappenas menekankan pentingnya perencanaan yang berjenjang, mulai dari RPJMN hingga rencana tahunan. Perencanaan tahunan berfungsi sebagai pengatur ritme pelaksanaan, terutama dalam konteks keterbatasan fiskal dan masa transisi pemerintahan. Prioritisasi menjadi kunci agar program dengan daya ungkit terbesar dapat dijalankan terlebih dahulu.</p><p>Menutup pernyataannya, Deputi Chandra menekankan bahwa tantangan pembangunan harus menjadi penguat kebijakan, bukan alasan untuk menurunkan target. “Kita harus optimis bahwa kita bisa, tetapi memang harus realistis. Dua itu harus menjadi patokan kita sebagai planner,” pungkas Deputi Chandra.</p>"
      },
      {
        slug: "bappenas-tegaskan-peran-sentral-perencanaan-dalam-target-pertumbuhan-ekonomi-8-persen",
        title: "Bappenas Tegaskan Peran Sentral Perencanaan dalam Target Pertumbuhan Ekonomi 8 Persen",
        excerpt: "Kementerian PPN/Bappenas menetapkan target pertumbuhan ekonomi 8 persen dalam RPJMN 2025–2029 melalui perencanaan strategis berbasis skenario dan kebijakan yang terukur untuk mendorong pertumbuhan ekonomi yang inklusif, berkualitas, dan berkelanjutan.",
        image: "https://drive.google.com/thumbnail?id=1BsdKW7IqDvSDnDS8EVjwYzi_N4u09F5j&sz=w2000",
        category: "Ekonomi",
        author: "Admin PMP",
        date: "26 Januari 2026",
        gallery:[
          "https://drive.google.com/thumbnail?id=1t2Z06UEYbelc-zm26CzAQgRDlVCAD2EF&sz=w2000",
          "https://drive.google.com/thumbnail?id=1QtHZrVN-erPUCxSxRA8AX7sHv_XiOk9v.jpeg&sz=w2000"
        ],
        content: "<p>Kementerian PPN/Bappenas menetapkan target pertumbuhan ekonomi delapan persen dalam dokumen Rencana Pembangunan Jangka Menengah Nasional (RPJMN) 2025-2029 melalui proses perencanaan strategis yang dilaksanakan secara sistematis.</p><p>Hal ini ditegaskan oleh Deputi Bidang Perencanaan Makro Pembangunan Kementerian PPN/Bappenas Eka Chandra Buana dalam Podcast Bappenas yang membahas arah pembangunan nasional lima tahun ke depan. Deputi Chandra menjelaskan bahwa RPJMN merupakan jembatan antara visi presiden dan arah pembangunan jangka panjang Indonesia. Bukan sekadar target ambisius, melainkan sasaran yang dirancang untuk dapat dicapai secara terukur.</p><p>RPJMN 2025–2029 merupakan penerjemahan dari visi misi presiden yang dituangkan dalam konsep Asta Cita. Di dalam Asta Cita terdapat beberapa target ekonomi, seperti target pertumbuhan ekonomi delapan persen, pengurangan kemiskinan, pengurangan kesenjangan, dan peningkatan kualitas sumber daya manusia.</p><p>“Namun, sering kali narasi yang muncul di masyarakat adalah mungkin atau tidak mungkin. Tapi bagi kami sebagai planner, yang terpenting bukan itu. Yang paling penting adalah caranya seperti apa,” jelas Deputi Chandra, Senin (26/1).</p><p>“Tantangan global selalu ada, mulai dari konflik geopolitik hingga ketidakpastian ekonomi dunia. Kalau kita setiap kali berhenti karena tantangan, ya tidak akan pernah selesai. Justru tugas kami adalah mendesain bagaimana target itu bisa dicapai di tengah berbagai risiko,” tambah Deputi Chandra.</p><p>Untuk menjawab tantangan tersebut, Kementerian PPN/Bappenas menggunakan pendekatan berbasis baseline dan skenario, serta pendekatan yang bersifat inklusif dan berkualitas dalam setiap proses penyusunan perencanaan.</p><p>“Baseline itu artinya kalau kita mau naik ke enam persen, tujuh persen, delapan persen, maka kita harus jelas: apa yang kita lakukan di setiap level itu. Jadi kuncinya bukan di angka 8 persen, tetapi pada desain kebijakannya. Kita juga butuh pertumbuhan yang cukup tinggi karena kita masih harus mengurangi kemiskinan, memperbaiki ketimpangan, dan meningkatkan kualitas SDM. Jadi bukan sekadar tumbuh, tetapi tumbuh dengan dampak yang nyata bagi masyarakat,” tambah Deputi Chandra.</p><p>Dari sisi pembiayaan, Deputi Chandra mengungkapkan bahwa untuk mencapai pertumbuhan di kisaran delapan persen, Indonesia membutuhkan investasi sekitar Rp48.000 triliun dalam lima tahun ke depan. Porsi pembiayaan pemerintah diperkirakan hanya sekitar delapan persen, sementara sisanya diharapkan berasal dari sektor swasta dan BUMN. Kondisi ini menegaskan bahwa peran pemerintah bukan hanya sebagai pelaksana, tetapi juga sebagai perancang ekosistem kebijakan yang kondusif.</p><p>Bagi Kementerian PPN/Bappenas, target pertumbuhan delapan persen bukan sekadar angka, melainkan arah kolektif pembangunan yang harus dirancang secara cermat, dikawal secara konsisten, dan dieksekusi bersama lewat peningkatan produktivitas.</p><p>Dalam kerangka perencanaan tersebut, Kementerian PPN/Bappenas merancang kerangka strategi yang dikenal sebagai “8+1”, yang mencakup swasembada pangan, energi, dan air; industrialisasi hijau; penguatan pariwisata dan ekonomi kreatif; pengembangan kota sebagai pusat pertumbuhan baru; penguatan investasi; belanja negara sebagai katalis; transformasi digital; serta sinkronisasi kebijakan fiskal, moneter, dan sektoral.</p><p>Menutup pernyataannya, Deputi Chandra menyampaikan pesan utama dari proses perencanaan Kementerian PPN/Bappenas. “Tantangan itu bukan alasan untuk menurunkan cita-cita. Justru tantangan memperkaya kebijakan kita. Kita harus optimis bahwa kita bisa, tetapi tetap realistis,” tutup Deputi Chandra.</p>"
      },
      {
        slug: "bappenas-undp gelar lokakarya regional-petakan-potensi-pendanaan-dukung-pelaksanaan-ekonomi-biru-di-asean",
        title: "Bappenas–UNDP Gelar Lokakarya Regional, Petakan Potensi Pendanaan Dukung Pelaksanaan Ekonomi Biru di ASEAN",
        excerpt: "Kementerian PPN/Bappenas bersama UNDP Indonesia menyelenggarakan lokakarya regional ASEAN Blue Carbon and Finance Profiling untuk memperkuat kolaborasi negara-negara ASEAN dalam pengelolaan karbon biru dan pengembangan pembiayaan inovatif guna mendukung pembangunan ekonomi biru yang berkelanjutan.",
        image: "https://drive.google.com/thumbnail?id=1NAEH_b014HNATGH0-HUBQUjYI1PA7nKZ&sz=w2000",
        category: "Ekonomi Biru",
        author: "Admin PMP",
        date: "27 November 2025",
        gallery:[
          "https://drive.google.com/thumbnail?id=1ktF1UcxXwqKAWOkKOZGKfxYAHyemKp2U&sz=w2000",
          "https://drive.google.com/thumbnail?id=14eoD_egtBVjujlkgklx6UR0aM18rvr8D&sz=w2000"
        ],
        content: "<p>Kementerian PPN/Bappenas bersama UNDP Indonesia berkolaborasi sebagai co-host dalam pelaksanaan lokakarya regional bertajuk Regional Workshop on ASEAN Blue Carbon and Finance Profiling pada 27-28 November 2025. Lokakarya ini merupakan bagian dari rangkaian proyek ASEAN Blue Carbon and Finance Profiling yang digagas oleh UNDP dengan dukungan pendanaan dari Pemerintah Jepang, yang bertujuan untuk memperkuat pengelolaan ekosistem karbon biru yang berkelanjutan dan mempersiapkan landasan bagi mobilisasi pendanaan ke sektor ekonomi biru di ASEAN.</p><p>Proyek ini dilakukan di bawah payung ASEAN Coordinating Task Force on Blue Economy (ACTF-BE) dan memiliki tiga komponen utama, yakni Blue Carbon Profiling, Blue Finance Profiling, dan Regional Platform for Knowledge Exchange. Komponen-komponen ini nantinya dapat memberikan gambaran mengenai kekayaan dan potensi ekosistem karbon biru di negara-negara ASEAN, serta mendorong eksplorasi pembiayaan inovatif dan mendukung kolaborasi serta pembelajaran bersama mengenai karbon biru dan pendanaan biru.</p><p>Peran strategis Kementerian PPN/Bappenas pada ACTF-BE, serta kembali terpilihnya Deputi Bidang Perencanaan Makro Pembangunan yang sebelumnya diemban Deputi Bidang Ekonomi, sebagai Shepherd ACTF-BE periode 2026-2027, menjadi landasan bagi UNDP untuk melibatkan Kementerian PPN/Bappenas dalam pelaksanaan lokakarya tersebut. “Melalui workshop ini, saya yakin seluruh peserta akan memperoleh pemahaman yang lebih mendalam mengenai Blue Carbon dan Blue Finance Profiling, sekaligus memperkuat semangat kolaborasi yang menjadi ciri khas kawasan kita, sehingga upaya kolektif ASEAN dalam menghadapi tantangan pembangunan Ekonomi Biru dapat dijalankan dengan lebih efektif,” ujar Deputi Bidang Perencanaan Makro Pembangunan Kementerian PPN/Bappenas Eka Chandra Buana selaku Shepherd ACTF-BE membuka lokakarya ini pada Kamis (27/11).</p><p>Turut hadir Deputi Bidang Pangan, Sumber Daya Alam, dan Lingkungan Hidup Kementerian PPN/Bappenas Leonardo A.A. Teguh Sambodo selaku Lead Representative Indonesia pada ACTF-BE, memaparkan Lessons Learned from Indonesia in Advancing Blue Economy. “Kami berharap bahwa upaya pengembangan Ekonomi Biru di Indonesia dapat menjadi rujukan bagi negara-negara ASEAN, karena ASEAN Blue Economy Framework memberikan arah strategis bagi kawasan untuk menjadikan laut sebagai pendorong utama pertumbuhan. Melalui workshop ini, Indonesia mendorong negara-negara anggota untuk berbagi pengalaman dan memperluas peluang kerja sama mulai dari teknologi, pendanaan, investasi, penguatan kapasitas, akses pasar global, pembangunan infrastruktur, dialog kebijakan, maupun konservasi laut. Ekosistem karbon biru yang sehat serta pembiayaan biru yang kuat menjadi fondasi penting untuk memobilisasi investasi dan memastikan pembangunan ekonomi biru yang berkelanjutan bagi masyarakat dan generasi mendatang,” ungkap Deputi Teguh.</p><p>Lokakarya yang melibatkan partisipasi dari para ahli, civitas academica, institusi terkait, serta perwakilan dari negara-negara anggota ASEAN ini, menjadi wadah bagi para ahli untuk mempresentasikan dan membahas rancangan profil, bertukar wawasan, serta mengumpulkan umpan balik terkait pengelolaan ekosistem karbon biru dan implementasi pendanaan biru inovatif dari negara masing-masing untuk memperkuat hasil akhir dari proyek tersebut. Sejak kick-off yang telah dilakukan pada tanggal 20 Mei 2025, 22 orang ahli dari seluruh negara ASEAN yang tergabung di dalam proyek ini telah menghasilkan sejumlah perkembangan substansial untuk konsep profil karbon biru dan keuangan biru, sehingga dapat rampung pada akhir 2025.</p>"
      },
      {
        slug: "bappenas-siapkan-master-plan-produktivitas-nasional-sebagai-kunci-wujudkan-indonesia-emas-2045",
        title: "Bappenas Siapkan Master Plan Produktivitas Nasional sebagai Kunci Wujudkan Indonesia Emas 2045",
        excerpt: "Kementerian PPN/Bappenas menyusun Master Plan Produktivitas Nasional (MPPN) sebagai panduan transformasi menuju pertumbuhan berbasis produktivitas guna mempercepat terwujudnya Indonesia Emas 2045.",
        image: "https://drive.google.com/thumbnail?id=1A_3x6iRTe33bfgk--X20n566tN3bR_pA&sz=w2000",
        category: "Produktivitas",
        author: "Admin PMP",
        date: "28 Agustus 2025",
        gallery:[
          "https://drive.google.com/thumbnail?id=1D3OPI02h7Ja_qTy0UjzZRTOiEWH-sCFQ&sz=w2000",
          "https://drive.google.com/thumbnail?id=1jIziX26P6HcY6QJh3DgiVHjIA6pPZ3rB&sz=w2000"
        ],
        content: "<p>Kementerian PPN/Bappenas terus berkomitmen mendorong transformasi ekonomi Indonesia untuk keluar dari jebakan pendapatan menengah (middle income trap) dan mampu bersaing di panggung global, melalui penyusunan Master Plan Produktivitas Nasional (MPPN). “Master Plan ini diharapkan menjadi instrumen bersama untuk menjadikan produktivitas sebagai motor penggerak utama pembangunan nasional menuju Indonesia Emas 2045,” urai Deputi Bidang Perencanaan Makro Pembangunan Kementerian PPN/Bappenas Eka Chandra Buana dalam acara Diseminasi Draf Laporan Akhir Master Plan Produktivitas Nasional (MPPN) di Jakarta, Kamis (28/8).</p><p>Kementerian PPN/Bappenas menyampaikan hasil penyusunan MPPN sekaligus menghimpun masukan dari para pemangku kepentingan sebelum dokumen tersebut diresmikan. Melalui kolaborasi dengan Asian Productivity Organization (APO), MPPN menghadirkan kerangka awal yang akan menjadi panduan bagi Indonesia dalam mengarahkan pembangunan menuju era productivity-led growth.</p><p>Staf Ahli Menteri Bidang Sosial dan Penanggulangan Kemiskinan Kementerian PPN/Bappenas Pungkas Bahjuri Ali menambahkan, peningkatan produktivitas tidak hanya menyangkut ekonomi, tetapi juga kesejahteraan masyarakat. “Pertumbuhan berbasis produktivitas akan berdampak pada pengurangan kemiskinan, penciptaan pekerjaan layak, dan memperkuat ketahanan sosial ekonomi Indonesia,” jelas Sahli Pungkas.</p><p>Sementara itu, Head of the In-Country Programs Division APO Arsyoni Buana menyoroti pentingnya Total Factor Productivity (TFP) dalam mempercepat pembangunan. Sebagai penentu utama produktivitas suatu negara, TFP yang kuat harus didukung oleh inovasi, teknologi, dan pendidikan. Dukungan modal dan tenaga kerja yang dimiliki setiap negara, diharapkan mampu mengoptimalkan tercapainya target pertumbuhan jangka panjang dan berkelanjutan.</p>"
      }
    ];

    /* ===== Data Publikasi ===== */
    const IMAGE_DATA = {
      logoDark:"https://drive.google.com/thumbnail?id=1pOgMz6726xiCsSIedvJeCFd81qbWwHG0&sz=w2000",
      logoLight:"https://drive.google.com/thumbnail?id=1M7k4byBQIu07EiSPjbKlRfB-YzjNFK0V&sz=w2000",
      chandra:"https://drive.google.com/thumbnail?id=1rl63_xISbzVFB7L-sV80bsxwVyrKodHs&sz=w2000",
      ewin:"https://drive.google.com/thumbnail?id=1U6ledpnvqBWtJer8tD3R7aJIGwOHwwN-&sz=w2000",
      ibnu:"https://drive.google.com/thumbnail?id=1Xb0N_oj6VX21py8rbOwRfeFXqF-sOPkD&sz=w2000",
      tari:"https://drive.google.com/thumbnail?id=1QHxBMCJfcjQfA6529wDh_mk-FaD6pJqJ&sz=w2000",
      laksmi:"https://drive.google.com/thumbnail?id=1Mxy_X3PzmiwOwSos00CGTnqz6x-LZc2q&sz=w2000",
      uke:"https://drive.google.com/thumbnail?id=1bqJTcIOabzc5oymUd64vUhcpcBppXVzW&sz=w2000",
      heriyadi:"https://drive.google.com/thumbnail?id=1PqkixAW9OjX6b7dkrcZLIuZfkVNBNaHy&sz=w2000"
    };
    const dashboards = [
      {
        slug: "kinerja",
        title: "Dashboard Kinerja",
        url: "https://dashboardkinerja.tatakelolapmp.workers.dev/",
        status: "private"
      },
      {
        slug: "agent-ai",
        title: "Agent AI Kedeputian PMP",
        url: "https://agent-mih.tatakelolapmp.workers.dev/",
        status: "private"
      },
      {
        slug: "dashboard-kepegawaian",
        title: "Dashboard Kepegawaian",
        url: "https://dashboardkepegawaian.tatakelolapmp.workers.dev/",
        status: "private"
      }
    ];
export const units: Unit[] = [
      {
        slug: "deputi",
        name: "Kedeputian Bidang Perencanaan Makro Pembangunan",
        head: "Dr. Eka Chandra Buana, S.E., M.A.",
        position: "Deputi Bidang Perencanaan Makro Pembangunan",
        email: "chandra@bappenas.go.id",
        image: "chandra",
        profilPimpinanId: `Dr. Eka Chandra Buana, S.E., M.A. lahir di Jakarta pada 30 Mei 1976. Beliau menyelesaikan pendidikan Sarjana Ilmu Ekonomi di Universitas Gadjah Mada pada tahun 1999. Selanjutnya, beliau meraih gelar Master of Economics dari Georgia State University, Amerika Serikat, pada tahun 2002, dan memperoleh gelar Doktor Kepemimpinan dan Inovasi Kebijakan dari Universitas Gadjah Mada pada tahun 2025.<br>
        <br>Beliau mengawali karier di Kementerian PPN/Bappenas pada tahun 2002 sebagai Kepala Seksi Moneter dan Perbankan. Selanjutnya, beliau menjabat sebagai Perencana Muda, Kepala Subdirektorat Pembiayaan Mikro, Kepala Subdirektorat Alokasi Pendanaan Pembangunan Pemerintah Daerah, Kepala Subdirektorat Alokasi Pendanaan Pembangunan Pusat, Kepala Subdirektorat Alokasi Pendanaan Pemerintah Pusat Bidang Ekonomi, Maritim, dan Sumber Daya, Pelaksana Tugas (Plt.) Direktur Keuangan Negara dan Analisis Moneter, serta Direktur Perencanaan Makro dan Analisis Statistik. Sejak Januari 2025, beliau diamanahkan sebagai Deputi Bidang Perencanaan Makro Pembangunan pada Kementerian Perencanaan Pembangunan Nasional/Badan Perencanaan Pembangunan Nasional (Bappenas) dan menjabat hingga saat ini.<br>
        <br>Selama menjalankan tugasnya, beliau berkontribusi dalam berbagai kebijakan strategis nasional, antara lain pengembangan konsep Kerangka Ekonomi Makro Daerah (KEMD), koordinasi penyusunan substansi RPJPN 2025–2045, pengembangan Dashboard Data SDGs dan Bappenas Policy Modelling Dashboard, serta sinkronisasi RPJPN dengan RPJPD bersama Kementerian Dalam Negeri. Selain itu, beliau aktif mewakili Indonesia dalam berbagai forum internasional dan saat ini menjabat sebagai Shepherd ASEAN Coordinating Task Force on Blue Economy (ACTF-BE) serta Wakil Ketua I Forum Masyarakat Statistik (FMS).<br>
        <br>
        <h3>Penghargaan</h3>
        <ul>
          <li>Shepherd ASEAN Coordinating Task Force on Blue Economy (ACTF-BE) periode 2024–2027.</li>
          <li>Wakil Ketua I Forum Masyarakat Statistik (FMS) periode 2025–2026.</li>
          <li>Ketua Pejabat Pembuat Komitmen (PPK) Kedeputian Ekonomi, tahun 2010.</li>
          <li>Penerima Satyalancana Wira Karya, tahun 2023.</li>
          <li>Penerima Satyalancana Karya Satya XX, tahun 2020.</li>
          <li>Penerima Satyalancana Karya Satya X, tahun 2011.</li>
          <li>Kepemimpinan Nasional (PKN) Tingkat II Angkatan XVIII, LAN RI Kominfo, tahun 2024.</li>
          <li>Certified Governance, Risk, and Compliance for Executive (GRCE) dari BNSP, tahun 2023.</li>
          <li>7th Temasek Foundation Leader in Economic Development Programme, Temasek Foundation dan Civil Service College Singapore, tahun 2021.</li>
          <li>Nurturing Leadership Programme, Bappenas–Motekar, Bandung, tahun 2019.</li>
        </ul>`,
        tugasUnitKerjaId: "Deputi Bidang Perencanaan Makro Pembangunan mempunyai tugas menyelenggarakan koordinasi, perumusan kebijakan, sinkronisasi pelaksanaan kebijakan, pemantaian, evaluasi dan pengendalian, serta penyusunan prakarsa strategis pembangunan lintas sektor perencanaan pembangunan nasional di bidang perencanaan makro pembangunan.",
        fungsiUnitKerjaId: `
        Dalam melaksanakan tugas, Deputi menyelenggarakan fungsi:
        <ul>
          <li>koordinasi, sinkronisasi, perumusan, dan penetapan kebijakan perencanaan pembangunan nasional dalam mendukung pencapaian pertumbuhan yang berkualitas dan berkelanjutan, penurunan kemiskinan, dan peningkatan produktivitas sumber daya manusia di bidang perencanaan makro pembangunan;</li>
          <li>koordinasi, sinkronisasi, dan integrasi penyusunan rencana pembangunan nasional;</li>
          <li>koordinasi, analisis, dan perumusan kebijakan perencanaan pembangunan nasional untuk tema, sasaran, arah kebijakan prioritas pembangunan nasional, kerangka ekonomi makro nasional dan wilayah, dan kerja sama internasional di bidang perencanaan makro pembangunan;</li>
          <li>koordinasi, perumusan, dan penyusunan keselarasan kebijakan ekomoni termasuk penetapan asumsi dasar ekonomi makro, koherensi dan konsistensi kebijakan ekonomi, dan analisis kebutuhan investasi yang bersumber dari Anggaran Pendapatan dan Belanja Negara dan non-Anggaran Pendapatan dan Belanja Negara;</li>
          <li>koordinasi dan sinkronisasi penyusunan kebijakan di bidang analisis statistic, kebutuhan investasi fiscal, dan moneter dalam penyusunan Anggaran Pendapatan dan Belanja Negara;</li>
          <li>koordinasi dan sinkronisasi penentuan sasaran dan target makro pembangunan nasional;</li>
          <li>penyusunan prakarsa strategis pembangunan lintas sektor melalui pengembangan model inovatif pembangunan sebagai dasar penerapan dan pelembagaan kementerian/Lembaga/pemerintah daerah di bidang perencanaan makro pembangunan;</li>
          <li>koordinasi percepatan pelaksanaan program rencana pembangunan nasional di bidang perencanaan makro pembangunan;</li>
          <li>koordinasi percepatan pelaksanaan rencana pembangunan nasional dan fasilitasi penyelesaian isu pelaksanaan pembangunan nasional di bidang perencanaan makro pembangunan;</li>
          <li>pemantauan dan evaluasi pelaksanaan program dan kegiatan pembangunan di bidang perencanaan makro pembangunan;</li>
          <li>pelaksanaan evaluasi dan pelaporan pelaksanaan tugas dan fungsi perencanaan pembangunan nasional di bidang perencanaan makro pembangunan;</li>
          <li>pelaksanaan administrasi Deputi; dan</li>
          <li>pelaksanaan fungsi lain yang diberikan oleh Menteri/Kepala.</li>
        </ul>
        <br>
        <strong>Struktur Organisasi</strong><br>
        Susunan organisasi Deputi Bidang Perencanaan Makro Pembangunan terdiri atas:
        <ul>
          <li>Sekretariat Deputi;</li>
          <li>Direktorat Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan;</li>
          <li>Direktorat Perencanaan Fiskal, Moneter, dan Sektor Keuangan;</li>
          <li>Direktorat Perencanaan Hilirisasi dan Kerjasama Ekonomi Internasional;</li>
          <li>Direktorat Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik; dan</li>
          <li>Direktorat Sinergi dan Tata Kelola Perencanaan Pembangunan.</li>
        </ul>`
      },
      {
        slug: "sesdep",
        name: "Sekretariat Deputi Bidang Perencanaan Makro Pembangunan",
        head: "Ewin Sofian Winata, ST, MEM",
        position: "Sekretaris Deputi Bidang Perencanaan Makro Pembangunan",
        email: "ewin.sofianwinata@bappenas.go.id",
        image: "ewin",
        profilPimpinanId: `Ewin Sofian Winata, ST, MEM lahir di Sumbawa, Nusa Tenggara Barat, pada tanggal 14 Mei 1982. Menempuh pendidikan S1 Teknik Pengairan di Universitas Brawijaya dan memperoleh gelar Sarjana Teknik pada tahun 2005 dengan predikat Cum Laude. Selanjutnya menempuh pendidikan S2 Environmental Management di Yale University, Amerika Serikat, dan memperoleh gelar Master of Environmental Management pada tahun 2017.<br>
        <br>Mengawali kariernya di Kementerian PPN/Bappenas pada Desember 2009 sebagai Staf Perencana di Direktorat Pengairan dan Irigasi. Selanjutnya pada Maret 2012–Februari 2019 menjabat sebagai Fungsional Perencana Pertama dan Fungsional Perencana Muda pada Direktorat Pengairan dan Irigasi. Pada April 2019–September 2020 beliau dipercaya sebagai Kepala Subdirektorat Kelembagaan Sarana dan Prasarana Sumber Daya Air, Direktorat Pengairan dan Irigasi. Kemudian pada September 2020–Desember 2020 menjabat sebagai Kepala Subdirektorat Sungai, Pantai, dan Pengendalian Daya Rusak Air, Direktorat Sumber Daya Air. Sejak Desember 2020 hingga Mei 2025 beliau menjabat sebagai Fungsional Perencana Madya (Koordinator) pada Direktorat Sumber Daya Air. Pada tahun 2025 beliau dilantik sebagai Sekretaris Deputi Bidang Perencanaan Makro Pembangunan, Kementerian PPN/Bappenas dan menjabat hingga saat ini.
        <br>
        <h3>Penghargaan</h3>
        <ul>
          <li>Editor’s Choice Finalist untuk artikel The power of social media: Reducing financial damages during disasters</li>
          <li>Satyalancana Karya Satya X Tahun dari Presiden Republik Indonesia, tahun 2020.</li>
          <li>Anggota Delegasi Indonesia pada pembahasan Indonesia–Australia MoU on Water Resources Development Planning, Australia, tahun 2023.</li>
          <li>Penyaji pada Regional Technical Workshop on Water Scarcity, Thailand, tahun 2024.</li>
          <li>Penyaji pada Regional Workshop on Eco-Efficient Water Infrastructure towards Sustainable Urban Development and Green Economy in Asia and the Pacific (UN-ESCAP), Thailand, tahun 2013.</li>
          <li>Penyaji pada The International Wrap-up Event on Safe Use of Wastewater in Agriculture (UN-Water/FAO), Iran, tahun 2013.</li>
          <li>Peserta Technical Deep Dive on Cities and Climate Change, Jepang, tahun 2024.</li>
          <li>Peserta Knowledge Sharing Program on Rehabilitation and Reconstruction from Disaster (JICA), Jepang, tahun 2019.</li>
        </ul>`,
        tugasUnitKerjaId: "Sekretariat Deputi mempunyai tugas melaksanakan koordinasi perencanaan, pelaksanaan, pemantauan, evaluasi kinerja dan keuangan, dan pemberian dukungan teknis dan administrasi kepada seluruh unit organisasi di lingkungan Deputi.",
        fungsiUnitKerjaId: `
        Dalam melaksanakan tugas, Sekretariat Deputi Bidang Perencanaan Makro Pembangunan menyelenggarakan fungsi:
        <ul>
          <li>koordinasi dan penyusunan rencana program dan anggaran pada Deputi Bidang Perencanaan Makro Pembangunans;
          </li><li>koordinasi, sinkronisasi, dan integrasi program dan tugas lintas direktorat pada Deputi Bidang Perencanaan Makro Pembangunan;
          </li><li>koordinasi kepatuhan internal dan manajemen risiko internal serta manajemen kinerja internal pada Deputi Bidang Perencanaan Makro Pembangunan;
          </li><li>koordinasi penyusunan pelaporan pemantauan, pengendalian, evaluasi, tindak lanjut temuan dan rekomendasi, serta manajemen risiko pembangunan pada Deputi Bidang Perencanaan Makro Pembangunan dalam mendukung sasaran pembangunan nasional;
          </li><li>fasilitasi, koordinasi, dan sinkronisasi penyusunan regulasi dan kebijakan, penataan organisasi, ketatalaksanaan, dan reformasi birokrasi pada Deputi Bidang Perencanaan Makro Pembangunan;
          </li><li>koordinasi dan pengelolaan sumber daya manusia pada Deputi Bidang Perencanaan Makro Pembangunan;  koordinasi dan pengelolaan keuangan pada Deputi Bidang Perencanaan Makro Pembangunan;
          </li><li>koordinasi dan pengelolaan administrasi barang milik negara pada Deputi Bidang Perencanaan Makro Pembangunan;
          </li><li>koordinasi dan pelaksanaan urusan hubungan masyarakat dan kerja sama, serta pengelolaan data dan informasi pada Deputi Bidang Perencanaan Makro Pembangunan;
          </li><li>pelaksanaan urusan ketatausahaan, keprotokolan, dan kerumahtanggaan pada Deputi Bidang Perencanaan Makro Pembangunan.
          </li>
        </ul>
        <br>
        <strong>Struktur Organisasi</strong><br>
        Dalam pelaksanaan tugas dan fungsinya, Sekretariat Deputi Bidang Perencanaan Makro Pembangunan terdiri atas jabatan fungsional dan jabatan pelaksana yang terdiri dari beberapa tim:
        <ul>
          <li>Tim Koordinasi Subtansi;</li>
          <li>Tim Tata Kelola, Kinerja, dan Kerjasama;</li>
          <li>Tim Program dan Anggaran;</li>
          <li>Tim Umum, Kearsipan, Rumah Tangga, dan Protokol.</li>
        </ul>`
      },
      {
        slug: "pempmp",
        name: "Direktorat Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan",
        head: "Ibnu Yahya, SE, M.Ec.Pol",
        position: "Direktur Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan",
        email: "ibnu.yahya@bappenas.go.id",
        image: "ibnu",
        profilPimpinanId: `Lahir di Cimahi, pada tahun 1984. Menempuh pendidikan S1 Ilmu Ekonomi di Universitas Indonesia. Gelar sarjananya diraih pada Tahun 2007. Menempuh pendidikan S2 Fakultas Bisnis dan Ekonomi (CBE) jurusan Kebijakan Ekonomi dari Universitas Nasional Australia (ANU), Canberra, Australia dan mendapatkan gelar Magister Ekonomi Politik Tahun 2017.<br>
        <br>Mengawali kariernya di Kementerian PPN/Bappenas pada Agustus 2019 – Agustus 2020 sebagai Pelaksana Tugas (Plt.) Kepala Subdirektorat Neraca Pembayaran, Direktorat Perencanaan Makro dan Analisis Statistik, Bappenas. Kemudian, di September 2020 – September 2024 menjadi Kepala/Koordinator Subdirektorat Neraca Pembayaran, Direktorat Perencanaan Makro dan Analisis Statistik, Bappenas. Dan pada September 2024 – Mei 2025 beliau menjadi Kepala/Koordinator Perencanaan Makroekonomi Nasional, Direktorat Perencanaan Makro dan Analisis Statistik, Bappenas. Dan pada tanggal 8 Mei 2025 dilantik menjadi Direktur Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan, Kementerian PPN/Bappenas hingga sekarang.
        <br>
        <h3>Penghargaan</h3>
        <ul>
          <li>Delegasi Pelatihan Statistik Neraca Nasional: Implementasi System of National Accounts (SNA) Japan  2008, tahun 2010</li>
          <li>Satya Lancana Karya Satya X Tahun, tahun 2018</li>
          <li>Delegasi Pelatihan Pengembangan Modal Manusia untuk Pembangunan Nasional, Seongnam, Korea Selatan, tahun 2020</li>
          <li>Agen Perubahan Pembangunan Zona Integritas (ZI) menuju Wilayah Bebas dari Korupsi (WBK) dan Wilayah Birokrasi Bersih dan Melayani (WBBM) di Direktorat Perencanaan Makro dan Analisis Statistik, tahun 2024</li>
        </ul>`,
        tugasUnitKerjaId: "Direktorat Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan mempunyai tugas melaksanakan koordinasi dan perumusan kebijakan, sinkronisasi pelaksanaan kebijakan, pemantauan, evaluasi dan pengendalian, serta penyusunan prakarsa strategis pembangunan lintas sektor perencanaan pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan.",
        fungsiUnitKerjaId: `
        Dalam melaksanakan tugas, Direktorat Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan menyelenggarakan fungsi:
        <ul>
          <li>Mengkoordinasikan dan Mengsinkronisasikan perumusan, dan penetapan kebijakan perencanaan pembangunan nasional dalam mendukung pencapaian pertumbuhan yang berkualitas dan berkelanjutan, penurunan kemiskinan, dan peningkatan produktivitas sumber daya manusia di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan, Mengsinkronisasikan dan Mengintegrasikan penyusunan rencana pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan, Menganalisis, dan Merumuskan kebijakan perencanaan pembangunan nasional untuk tema, sasaran, arah kebijakan prioritas pembangunan nasional, kerangka regulasi, kerangka kelembagaan, kerangka ekonomi makro nasional dan wilayah, dan kerja sama internasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan, Merumuskan, dan Menyusun keselarasan kebijakan ekonomi di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan dan Mengsinkronisasikan penyusunan kebijakan bidang analisis statistik, kebutuhan investasi, dan moneter dalam penyusunan Anggaran Pendapatan dan Belanja Negara di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan dan Mengsinkronisasikan penentuan sasaran dan target makro pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan, Menganalisis, dan Merumuskan kerangka kebijakan perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan, Mengsinkronisasikan, dan Mengintegrasi pelaksanaan kebijakan perencanaan dan pengalokasian anggaran pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Menyusun dan Mengsinkronisasikan rencana pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan dalam rencana dan perubahan Anggaran Pendapatan dan Belanja Negara bersama kementerian yang menyelenggarakan urusan pemerintahan di bidang keuangan serta instansi terkait;
          </li><li>Menyusun prakarsa strategis pembangunan lintas sektor melalui pengembangan model inovatif pembangunan sebagai dasar penerapan dan pelembagaan dalam rencana dan anggaran kementerian/lembaga/pemerintah daerah di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan percepatan pelaksanaan program rencana pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Mengkoordinasikan percepatan pelaksanaan rencana pembangunan nasional dan fasilitasi penyelesaian isu pelaksanaan pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan;
          </li><li>Melaksanakan pemantauan dan evaluasi pelaksanaan program dan kegiatan pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan; dan
          </li><li>Melaksanakan evaluasi dan pelaporan pelaksanaan tugas dan fungsi perencanaan pembangunan nasional di bidang perencanaan ekonomi makro dan pengembangan model pembangunan.</li>
        </ul>
        <br>
        <strong>Struktur Organisasi</strong><br>
        Dalam pelaksanaan tugas dan fungsinya, Direktorat Perencanaan Ekonomi Makro dan Pengembangan Model Pembangunan terdiri atas jabatan fungsional dan jabatan pelaksana yang terdiri dari beberapa tim:
        <ul>
          <li>Tim Sekretaris & Administrasi;</li>
          <li>Tim Kerangka Ekonomi Makro Daerah;</li>
          <li>Tim Kerangka Ekonomi Makro Nasional;</li>
          <li>Tim Neraca Pembangunan & Sektor Eksternal;</li>
          <li>Tim Pengembangan Model Pembangunan.</li>
        </ul>`
      },
      {
        slug: "pfmsk",
        name: "Direktorat Perencanaan Fiskal, Moneter, dan Sektor Keuangan",
        head: "Tari Lestari, S.Si, SE, MS",
        position: "Direktur Perencanaan Fiskal, Moneter, dan Sektor Keuangan",
        email: "tari.lestari@bappenas.go.id",
        image: "tari",
        profilPimpinanId: `Tari Lestari, S.Si., S.E., M.S., lahir di Garut pada 5 Oktober 1983, memiliki rekam jejak profesional selama 17 tahun sebagai perencana pembangunan di Kementerian PPN/Bappenas. Meraih gelar sarjana di bidang Ekonomi (2007) and Statistika (2006) dari Universitas Padjadjaran. Perjalanan akademisnya berlanjut ke Amerika Serikat serta berhasil memperoleh gelar Master of Science in Policy Economics dari University of Illinois at Urbana-Champaign, pada tahun 2011.
        <br><br>
        Kariernya di Kementerian PPN/Bappenas diawali sebagai Perencana Kebijakan Ekonomi pada tahun 2008 – 2016. Pengalaman tersebut membawa amanah untuk mengemban tanggung jawab sebagai Koordinator Analisis Pembiayaan dan Moneter (2017 – 2021) serta Direktur Analisis Keuangan Negara dan Moneter (2022 – April 2025). Selama periode Januari hingga April 2025, juga dipercaya sebagai Pelaksana Tugas (Acting) Direktur Perencanaan Makro dan Analisis Statistik. Selanjutnya, sejak Mei 2025 hingga saat ini, resmi dilantik sebagai Direktur Perencanaan Fiskal, Moneter, dan Sektor Keuangan, Kementerian PPN/Bappenas.
        <br>
        <h3>Penghargaan</h3>
        <ul>
          <li>Pelopor Perubahan Pembangunan Zona Integritas (ZI) Menuju Wilayah Bebas Korupsi (WBK) di Direktorat Keuangan Negara dan Analisis Moneter (2024)</li>
          <li>Penghargaan Sepuluh Tahun Pengabdian Pegawai Negeri Sipil (Satya Lencana Karya Satya) dari Pemerintah Indonesia (2018)</li>
          <li>Pemenang Penghargaan Duta Besar untuk Keunggulan (Ambassador's Award for Excellence) atas pencapaian luar biasa dalam mengejar keunggulan akademik dan non-akademik, serta menunjukkan kualitas kepemimpinan dan dedikasi yang luar biasa dalam prestasi akademik di Amerika Serikat, diberikan oleh Kedutaan Besar Republik Indonesia di Washington DC (2012)</li>
        </ul>`,
        tugasUnitKerjaId: "Direktorat Perencanaan Fiskal, Moneter, dan Sektor Keuangan mempunyai tugas melaksanakan koordinasi dan perumusan kebijakan, sinkronisasi pelaksanaan kebijakan, pemantauan, evaluasi dan pengendalian, serta penyusunan prakarsa strategis pembangunan lintas sektor perencanaan pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan.",
        fungsiUnitKerjaId: `
        Dalam melaksanakan tugas, Direktorat Perencanaan Fiskal, Moneter, dan Sektor Keuangan menyelenggarakan fungsi:
        <ul>
          <li>Mengkoordinasikan, mensinkronisasikan, merumuskan, dan menetapkan kebijakan perencanaan pembangunan nasional dalam mendukung pencapaian pertumbuhan yang berkualitas dan berkelanjutan, penurunan kemiskinan, dan peningkatan produktivitas sumber daya manusia di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan, mensinkronisasikan, dan mengintegrasikan penyusunan rencana pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan, menganalisis, dan merumuskan kebijakan perencanaan pembangunan nasional untuk tema, sasaran, arah kebijakan prioritas pembangunan nasional, kerangka regulasi, kerangka kelembagaan, ekonomi makro nasional and wilayah, dan kerja sama internasional di bidang perencanaan fiskal, moneter, and sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan, merumuskan, dan menyusun keselarasan kebijakan ekonomi di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan dan mensinkronisasikan penyusunan kebijakan bidang analisis statistik, kebutuhan investasi, dan moneter dalam penyusunan Anggaran Pendapatan dan Belanja Negara di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan dan mensinkronisasikan penentuan sasaran dan target makro pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan, menganalisis, dan merumuskan kerangka kebijakan perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan, mensinkronisasikan, dan mengintegrasikan pelaksanaan kebijakan perencanaan dan pengalokasian anggaran pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, and perencanaan sektor keuangan;
          </li><li>Menyusun dan mensinkronisasikan rencana pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan dalam rencana dan perubahan Anggaran Pendapatan dan Belanja Negara bersama kementerian yang menyelenggarakan urusan pemerintahan di bidang keuangan serta instansi terkait, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan dan merencana penyusunan kebijakan fiskal meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, dan pembiayaan;
          </li><li>Menyusun prakarsa strategis pembangunan lintas sektor melalui pengembangan model inovatif pembangunan sebagai dasar penerapan dan pelembagaan dalam rencana dan anggaran kementerian/lembaga/pemerintah daerah di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan percepatan pelaksanaan program rencana pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan;
          </li><li>Mengkoordinasikan percepatan pelaksanaan rencana pembangunan nasional dan fasilitasi penyelesaian isu pelaksanaan pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan dan analisis moneter, perencanaan fiskal, dan perencanaan sektor keuangan;
          </li><li>Melaksanakan pemantauan dan evaluasi pelaksanaan program dan kegiatan pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan; dan
          </li><li>Melaksanakan evaluasi dan pelaporan pelaksanaan tugas dan fungsi perencanaan pembangunan nasional di bidang perencanaan fiskal, moneter, dan sektor keuangan, paling sedikit meliputi penerimaan negara, belanja pemerintah pusat, transfer ke daerah, perimbangan keuangan, pembiayaan, perencanaan fiskal, analisis moneter, dan perencanaan sektor keuangan.
          </li>
        </ul>
        <br>
        <strong>Struktur Organisasi</strong><br>
        Dalam pelaksanaan tugas dan fungsinya, Direktorat Perencanaan Akses Keuangan, Moneter, dan Sektor Keuangan terdiri atas jabatan fungsional dan jabatan pelaksana yang terdiri dari beberapa tim:
        <ul>
          <li>Tim Sekretaris & Administrasi;</li>
          <li>Tim Perencanaan Fiskal;</li>
          <li>Tim Perencanaan Moneter;</li>
          <li>Tim Perencanaan Sektor Keuangan.</li>
        </ul>`
      },
      {
        slug: "phkei",
        name: "Direktorat Perencanaan Hilirisasi dan Kerjasama Ekonomi Internasional",
        head: "P.N. Laksmi Kusumawati, SE, MSE, MSc, Ph.D",
        position: "Direktur Perencanaan Hilirisasi dan Kerjasama Ekonomi Internasional",
        email: "pnl.kusumawati@bappenas.go.id",
        image: "laksmi",
        profilPimpinanId: `P.N. Laksmi Kusumawati, S.E., M.SE., M.Sc., Ph.D. lahir di Jakarta pada 17 Mei 1981. Beliau menyelesaikan pendidikan Sarjana Ekonomi di Fakultas Ekonomi dan Bisnis, Universitas Indonesia pada tahun 2003 dengan konsentrasi Ekonomi Moneter dan minor Ekonomi Internasional.<br>
        <br>
        Pada tahun 2008–2010, beliau melanjutkan studi magister melalui program double degree di Universitas Indonesia (2008–2009) and University of Groningen, Belanda (2009–2010). Dalam studi tersebut, beliau menyusun tesis berjudul Central Bank Reform and Bank Lending: Does the Credit Channel Work? di bawah supervisi Prof. Jakob de Haan.<br>
        <br>
        Komitmennya terhadap pengembangan ilmu ekonomi berlanjut melalui pendidikan doktoral di University of Groningen, Belanda, yang diselesaikan pada periode 2013–2018. Disertasinya berjudul Foreign Direct Investment, Inclusive Growth, and Institutions in Indonesia, di bawah bimbingan Prof. Joost Herman dan Prof. Ronald Holzhacker.<br>
        <br>
        Karier profesional beliau dimulai di Kementerian PPN/Bappenas sebagai Staf Perencana pada Direktorat Perencanaan Ekonomi Makro pada tahun 2005. Selama lebih dari satu dekade, beliau berkontribusi dalam perumusan kebijakan pembangunan ekonomi nasional, khususnya pada isu perencanaan makroekonomi dan transformasi struktural.<br>
        Pada tahun 2018, beliau dipercaya sebagai Staf Perencana pada Direktorat Jasa Keuangan dan Badan Usaha Milik Negara, sebelum kemudian menjabat sebagai Kepala Subdirektorat Jasa Keuangan Konvensional pada periode 2019–2020.<br>
        <br>
        Selanjutnya, pada periode 2020–2023, beliau mengemban amanah sebagai Pelaksana Utama Direktur Perdagangan, Investasi, dan Kerja Sama Ekonomi Internasional. Pada Juli 2023, beliau resmi diangkat sebagai Direktur Perdagangan, Investasi, dan Kerja Sama Ekonomi Internasional hingga Mei 2025.<br>
        Sejak Mei 2025 hingga saat ini, beliau menjabat sebagai Direktur Perencanaan Hilirisasi dan Kerja Sama Ekonomi Internasional di Kementerian PPN/Bappenas, dengan tanggung jawab memimpin perumusan kebijakan strategis nasional terkait hilirisasi industri, transformasi ekonomi, investasi, serta penguatan kerja sama ekonomi internasional untuk mendukung agenda pembangunan berkelanjutan Indonesia
        <br>
        <h3>Penghargaan</h3>
        <ul>
          <li>Satya Lancana Karya Satya X Tahun, tahun 2015</li>
          <li>Certified Governance Risk Compliance for Executive (GRCE) – 2023</li>
          <li>Pengarah Penyusunan Booklet Pemantauan dan Fasilitasi Daftar Proyek Prioritas Investasi Swasta (DPPIS) dalam RKP 2023–2024</li>
          <li>Penanggung Jawab Penyusunan dan Peluncuran Perhitungan Biaya Logistik Nasional Tahun 2022, 2023</li>
          <li>Satya Lancana Karya Satya XX Tahun, tahun 2025</li>
          <li>Program Khusus Rekognisi Pembelajaran Lampau (RPL) Jenjang Jabatan Pimpinan Tinggi (JPT) Pratama – Lembaga Administrasi Negara (LAN), 2025</li>
          <li>Wakil Direktur Paviliun Indonesia, Expo 2025 Osaka, Kansai, Jepang (Batch 12)</li>
          <li>Lead Negotiator Indonesia untuk Cluster Technical Assistance and Economic Cooperation (TAEC), Indo-Pacific Economic Framework for Prosperity (IPEF) on Pillar I: Trade, 2023.</li>
          <li>Lead Negotiator Indonesia untuk Working Group on Economic and Technical Cooperation (WG-ECOTECH), Indonesia-Canada Comprehensive Economic Partnership Agreement (ICA-CEPA), 2023–2024.</li>
          <li>Lead Negotiator Indonesia untuk Working Group on Sustainable Development and Green Economy (WG-SDGE), ASEAN-Korea Free Trade Agreement (AK-FTA) Upgrade, 2026.</li>
          <li>Ketua Sekretariat National Focal Point Indonesia untuk Standing Committee for Economic and Commercial Cooperation of the Organisation of Islamic Cooperation (COMCEC), 2020-2026</li>
          <li>Focal Point Indonesia pada Committee of Sustainable Growth for the Implementation of Regional Comprehensive Economic Partnership (RCEP), 2024–2026.</li>
          <li>Co-focal Point Indonesia untuk G20 Development Working Group (DWG), 2025.</li>
          <li>Vice Lead for Indonesia pada ASEAN Coordinating Task Force on Blue Economy (ACTF-BE), 2024–2026.</li>
          <li>Anggota Economic Cooperation Committee (ECC) pada Indonesia-Australia Comprehensive Economic Partnership Agreement (IA-CEPA) Economic Cooperation Program (ECP) Katalis, 2021–2025.</li>
        </ul>`,
        tugasUnitKerjaId: "Direktorat Perencanaan Hilirisasi dan Kerjasama Ekonomi Internasional mempunyai tugas melaksanakan koordinasi dan perumusan kebijakan, sinkronisasi implementasi kebijakan, pemantauan, evaluasi, dan pengendalian, serta penyusunan prakarsa strategis pembangunan lintas sektor dalam perencanaan pembangunan nasional di bidang hilirisasi dan kerjasama ekonomi internasional.",
        fungsiUnitKerjaId: `
        Dalam melaksanakan tugas tersebut, Direktorat Perencanaan Hilirisasi dan Kerja Sama Ekonomi Internasional menyelenggarakan fungsi sebagai berikut:
        <ul>
          <li>koordinasi, sinkronisasi, perumusan, dan penetapan kebijakan perencanaan pembangunan nasional dalam mendukung pencapaian pertumbuhan yang berkualitas dan berkelanjutan, penurunan kemiskinan, dan peningkatan produktivitas sumber daya manusia di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi, sinkronisasi, dan integrasi penyusunan rencana pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi, analisis, dan perumusan kebijakan perencanaan pembangunan nasional untuk tema, sasaran, arah kebijakan prioritas pembangunan nasional, kerangka regulasi, kerangka kelembagaan, kerangka ekonomi makro nasional dan wilayah, dan kerja sama internasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi, perumusan, dan penyusunan keselarasan kebijakan ekonomi di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi dan sinkronisasi penyusunan kebijakan bidang analisis statistik, kebutuhan investasi, dan moneter dalam penyusunan Anggaran Pendapatan dan Belanja Negara di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi dan sinkronisasi penentuan sasaran dan target makro pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi, analisis, dan perumusan kerangka kebijakan perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi, sinkronisasi, dan integrasi pelaksanaan kebijakan perencanaan dan pengalokasian anggaran pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>penyusunan dan sinkronisasi rencana pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional dalam rencana dan perubahan Anggaran Pendapatan dan Belanja Negara bersama kementerian yang menyelenggarakan urusan pemerintahan di bidang keuangan serta instansi terkait;
          </li><li>koordinasi dan merencanakan kerja sama ekonomi internasional meliputi kerja sama internasional yang berdampak pada investasi dan perdagangan antara lain Association of Southeast Asian Nations Economic Community, G20, Asia-Pasific Economic Cooperation, The Organisation for Economic Co-operation and Development, dan kerjasama ekonomi internasional lainnya;
          </li><li>penyusunan prakarsa strategis pembangunan lintas sektor melalui pengembangan model inovatif pembangunan sebagai dasar penerapan dan pelembagaan dalam rencana dan anggaran kementerian/lembaga/pemerintah daerah di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi percepatan pelaksanaan program rencana pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>koordinasi percepatan pelaksanaan rencana pembangunan nasional dan fasilitasi penyelesaian isu pelaksanaan pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional;
          </li><li>pemantauan dan evaluasi pelaksanaan program dan kegiatan pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional; dan
          </li><li>pelaksanaan evaluasi dan pelaporan pelaksanaan tugas dan fungsi perencanaan pembangunan nasional di bidang perencanaan hilirisasi dan kerja sama ekonomi internasional.
          </li>
        </ul>
        <br>
        <strong>Struktur Organisasi</strong><br>
        Dalam pelaksanaan tugas dan fungsinya, Direktorat Perencanaan Hilirisasi dan Kerjasama Ekonomi Internasional terdiri atas jabatan fungsional dan jabatan pelaksana yang terdiri dari beberapa tim:
        <ul>
          <li>Tim Perencanaan Hilirisasi 1 (Minerba & Migas);</li>
          <li>Tim Perencanaan Hilirisasi 2 (Perkebunan & Kehutanan);</li>
          <li>Tim Perencanaan Hilirisasi 3 (Kelautan Perikanan);</li>
          <li>Tim Kerjasama Ekonomi Internasional.</li>
        </ul>`
      },
      {
        slug: "p4t",
        name: "Direktorat Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik",
        head: "Uke Mohammad Hussein, S.Si, MPP",
        position: "Direktur Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik",
        email: "umh@bappenas.go.id",
        image: "uke",
        profilPimpinanId: `Lahir di Jakarta pada tahun 1970, beliau menyelesaikan pendidikan Sarjana Geografi di Universitas Indonesia pada tahun 1996. Pendidikan pascasarjana ditempuh di The National Graduate Institute for Policy Studies (GRIPS), Tokyo, Jepang, dengan gelar Magister Kebijajan Publik yang diraih pada tahun 2001.<br><br>Beliau mengawali karier di Kementerian PPN/Bappenas pada tahun 1997 dan telah mengabdikan hampir tiga dekade dalam bidang perencanaan pembangunan nasional. Berbagai jabatan strategis pernah diemban, antara lain sebagai Kepala Seksi Rencana dan Program Tata Ruang (2002–2006) pada Direktorat Tata Ruang dan Pertanahan, Kepala Subdirektorat Data dan Informasi Kewilayahan (2009–2011) pada Direktorat Pengembangan Wilayah, Kepala Subdirektorat Pertanahan (2011–2016) pada Direktorat Tata Ruang dan Pertanahan , Direktur Tata Ruang dan Pertanahan (2016–2020), Direktur Regional I (2020–2022), serta Direktur Tata Ruang, Pertanahan, dan Penanggulangan Bencana (2022–2025). Sejak tahun 2025, beliau menjabat sebagai Direktur Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik
        <br>
        <h3>Penghargaan</h3>
        <ul>
          <li>Satyalancana Karya Satya X Tahun, Tahun 1998</li>
          <li>Satyalancana Karya Satya XX Tahun, Tahun 2017</li>
          <li>Satyalancana Wira Karya, Tahun 2023</li>
        </ul>`,
        tugasUnitKerjaId: "Direktorat Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik mempunyai tugas melaksanakan koordinasi dan perumusan kebijakan, sinkronisasi pelaksanaan kebijakan, pemantauan, evaluasi dan pengendalian, serta penyusunan prakarsa strategis pembangunan lintas sektor perencanaan pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik.",
        fungsiUnitKerjaId: `
        Dalam melaksanakan tugas, Direktorat Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik menyelenggarakan fungsi:
        <ul>
          <li>koordinasi, sinkronisasi, perumusan, dan penetapan kebijakan perencanaan pembangunan nasional dalam mendukung pencapaian pertumbuhan yang berkualitas dan berkelanjutan, penurunan kemiskinan, dan peningkatan produktivitas sumber daya manusia di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi, sinkronisasi, dan integrasi penyusunan rencana pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi, analisis, dan perumusan kebijakan perencanaan pembangunan nasional untuk tema, sasaran, arah kebijakan prioritas pembangunan nasional, kerangka regulasi, kerangka kelembagaan, kerangka ekonomi makro nasional dan wilayah, dan kerja sama internasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi, perumusan, dan penyusunan keselarasan kebijakan ekonomi di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi dan sinkronisasi penyusunan kebijakan bidang analisis statistik, kebutuhan investasi, dan moneter dalam penyusunan Anggaran Pendapatan dan Belanja Negara di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi dan sinkronisasi penentuan sasaran dan target makro pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi, analisis, dan perumusan kerangka kebijakan perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi, sinkronisasi, dan integrasi pelaksanaan kebijakan perencanaan dan pengalokasian anggaran pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik; 
          </li><li>penyusunan dan sinkronisasi rencana pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik dalam rencana dan perubahan Anggaran Pendapatan dan Belanja Negara bersama kementerian yang menyelenggarakan urusan pemerintahan di bidang keuangan serta instansi terkait;
          </li><li>penyusunan prakarsa strategis pembangunan lintas sektor melalui pengembangan model inovatif pembangunan sebagai dasar penerapan dan pelembagaan dalam rencana dan anggaran kementerian/lembaga/pemerintah daerah di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi dan sinkronisasi perencanaan tematik yang meliputi pengembangan ekonomi hijau, ekonomi biru, ekonomi oranye, dan tematik pembangunan ekonomi lainnya;
          </li><li>koordinasi percepatan pelaksanaan program rencana pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>koordinasi percepatan pelaksanaan rencana pembangunan nasional and fasilitasi penyelesaian isu pelaksanaan pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik;
          </li><li>pemantauan dan evaluasi pelaksanaan program dan kegiatan pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik; dan 
          </li><li>pelaksanaan evaluasi dan pelaporan pelaksanaan tugas dan fungsi perencanaan pembangunan nasional di bidang perencanaan peningkatan produktivitas dan pembangunan tematik.
          </li>
        </ul>
        <br>
        <strong>Struktur Organisasi</strong><br>
        Dalam pelaksanaan tugas dan fungsinya, Direktur Peningkatan Produktivitas dan Pembangunan Tematik didukung oleh:
        <ul>
          <li>Tim Secretariat and Administration;</li>
          <li>Tim Peningkatan Produktivitas;</li>
          <li>Tim Ekonomi Hijau;</li>
          <li>Tim Ekonomi Biru;</li>
          <li>Tim Ekonomi Oranye.</li>
        </ul>
        `
      },
      {
        slug: "sitala",
        name: "Direktorat Sinergi dan Tata Kelola Perencanaan Pembangunan",
        head: "Heriyadi, S.Sos, MT, MSc",
        position: "Direktur Sinergi dan Tata Kelola Perencanaan Pembangunan",
        email: "heriyadi@bappenas.go.id",
        image: "heriyadi",
        profilPimpinanId: `Heriyadi, S.Sos., M.T., M.Sc. lahir di Semarang pada 16 Oktober 1974. Menempuh pendidikan Sarjana (S1) Ilmu Komunikasi di Fakultas Ilmu Sosial dan Ilmu Politik Universitas Diponegoro and memperoleh gelar Sarjana pada tahun 1999. Selanjutnya, melanjutkan pendidikan Magister Perencanaan Kota dan Daerah di Universitas Gadjah Mada, Yogyakarta dan meraih gelar Magister pada tahun 2006. Kemudian, di tahun 2007 memperoleh gelar Master of Science (M.Sc.) di bidang Urban Management and Development dari IHS-Erasmus University, Rotterdam.<br>
        <br>
        Berkarier di Kementerian Perencanaan Pembangunan Nasional/Badan Perencanaan Pembangunan Nasional (Kementerian PPN/Bappenas), Heriyadi saat ini menjabat sebagai Direktur Sinergi dan Tata Kelola Perencanaan Pembangunan di Kedeputian Bidang Perencanaan Makro Pembangunan. Dalam kapasitas tersebut, beliau berperan dalam memperkuat koordinasi, sinergi, dan tata kelola perencanaan pembangunan guna mendukung pelaksanaan pembangunan nasional yang lebih efektif dan terintegrasi.
        <br>
        <h3>Penghargaan</h3>
        <ul>
          <li>Satyalancana Karya Satya XX Tahun</li>
          <li>Satyalancana Karya Satya X Tahun</li>
        </ul>`,
        tugasUnitKerjaId: "Direktorat Sinergi dan Tata Kelola Perencanaan Pembangunan mempunyai tugas melaksanakan koordinasi dan perumusan kebijakan, sinkronisasi pelaksanaan kebijakan, pemantauan, evaluasi dan pengendalian, serta penyusunan prakarsa strategis pembangunan lintas sektor perencanaan pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan.",
        fungsiUnitKerjaId: `
        Dalam melaksanakan tugas, Direktorat Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik menyelenggarakan fungsi sebagai berikut:
        <ul>
          <li>koordinasi, sinkronisasi, perumusan, dan penetapan  kebijakan perencanaan pembangunan nasional dalam mendukung pencapaian pertumbuhan yang berkualitas dan berkelanjutan, penurunan kemiskinan, dan peningkatan produktivitas sumber daya manusia di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi, sinkronisasi, dan integrasi penyusunan rencana pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi, analisis, dan perumusan kebijakan perencanaan pembangunan nasional untuk tema, sasaran, arah kebijakan prioritas pembangunan nasional, kerangka regulasi, kerangka kelembagaan, kerangka ekonomi makro nasional dan wilayah, dan kerja sama internasional di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi, perumusan, dan penyusunan keselarasan kebijakan ekonomi di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi dan sinkronisasi penyusunan kebijakan bidang analisis statistik, kebutuhan investasi, dan moneter dalam penyusunan Anggaran Pendapatan Belanja Negara di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi dan sinkronisasi penentuan sasaran dan target makro pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi, sinkronisasi, integrasi penyusunan rencana serta tata kelola pembangunan nasional jangka panjang, jangka menengah dan tahunan;
          </li><li>koordinasi penyusunan rencana strategis kementerian dan lembaga;
          </li><li>koordinasi, sinkronisasi, dan integrasi penggunaan evaluasi hasil pembangunan dalam penyusunan rencana pembangunan nasional;
          </li><li>koordinasi dan sinkronisasi penyusunan rencana induk, strategi nasional, peta jalan, atau dengan sebutan lainnya terkait penjabaran bidang perencanaan pembangunan nasional jangka panjang dan menengah;
          </li><li>penyusunan dan pengembangan standar dan prosedur penyusunan perencanaan pembangunan nasional;
          </li><li>koordinasi, sinkronisasi, dan integrasi pelaksanaan kebijakan perencanaan dan pengalokasian anggaran pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>penyusunan prakarsa strategis pembangunan lintas sektor melalui pengembangan model inovatif pembangunan sebagai dasar penerapan dan pelembagaan dalam rencana dan anggaran kementerian/lembaga/pemerintah daerah di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi percepatan pelaksanaan penyusunan program rencana pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>koordinasi percepatan pelaksanaan rencana pembangunan nasional dan fasilitasi penyelesaian isu pelaksanaan pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan;
          </li><li>pemantauan dan evaluasi pelaksanaan program dan kegiatan pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan; dan
          </li><li>pelaksanaan evaluasi dan pelaporan pelaksanaan tugas dan fungsi perencanaan pembangunan nasional di bidang sinergi dan tata kelola perencanaan pembangunan.
          </li>
        </ul>
        <br>
        <strong>Struktur Organisasi</strong><br>
        Dalam pelaksanaan tugas dan fungsinya, Direktorat Sinergi dan Tata Kelola Perencanaan Pembangunan terdiri atas jabatan fungsional dan jabatan pelaksana yang terdiri dari beberapa tim:
        <ul>
          <li>Tim Rencana Strategis;</li>
          <li>Tim Rancangan Awal Rencana Kerja Pemerintah;</li>
          <li>Tim Pemutakhiran Rencana Kerja Pemerintah.</li>
        </ul>`
      }
    ];

    /* ===== Data Modul Layanan ===== */
export const publications: Publication[] = [
      {
        slug: "master-plan-produktivitas-nasional-2025",
        title: "Master Plan Produktivitas Nasional",
        excerpt: "Dokumen ini disusun melalui kajian kondisi produktivitas, diskusi dengan berbagai pihak, serta site visit dan research visit ke berbagai daerah untuk melihat langsung kondisi lapangan dan tantangan produktivitas di sektor-sektor utama.",
        image: "https://drive.google.com/thumbnail?id=1Odvu--_VeOD1GeihOIAx5VTVzy7ip5MS&sz=w2000",
        category: "Produktivitas Nasional",
        author: "Direktorat Perencanaan Peningkatan Produktivitas dan Pembangunan Tematik",
        date: "15 Oktober 2025",
        documentUrl: "https://komens.bappenas.go.id/public/storage/files/Dt.01.04_Master_Plan_Produktivitas_Nasional_2025.pdf",
        documentName: "Dt.01.04_Master_Plan_Produktivitas_Nasional_2025.pdf",
        content: "<p>Masterplan Produktivitas Nasional (MPPN) merupakan dokumen kebijakan strategis yang disusun oleh Kementerian PPN/Bappenas bersama Kementerian Ketenagakerjaan, Kementerian Dalam Negeri dan Asian Productivity Organization (APO) sebagai pedoman nasional dalam mendorong pertumbuhan ekonomi berbasis produktivitas. Dokumen ini menjadi acuan lintas kementerian/lembaga, pemerintah daerah, dunia usaha, dan akademisi untuk memperkuat Total Factor Productivity (TFP) sebagai mesin utama pertumbuhan menuju Indonesia Emas 2045.</p><p>Dokumen ini disusun melalui kajian kondisi produktivitas, diskusi dengan berbagai pihak, serta site visit dan research visit ke berbagai daerah untuk melihat langsung kondisi lapangan dan tantangan produktivitas di sektor-sektor utama.</p><p>Dokumen ini bermanfaat sebagai acuan nasional dalam perencanaan dan pelaksanaan program peningkatan produktivitas, membantu penyelarasan kebijakan antar kementerian/lembaga dan daerah, serta memberikan arah strategis bagi dunia usaha dan masyarakat dalam mewujudkan pertumbuhan ekonomi yang lebih efisien, inovatif, dan inklusif.</p>"
      },
      {
        slug: "panduan-ekonomi-hijau-indonesia",
        title: "Panduan Implementasi Model Pembangunan Ekonomi Hijau",
        excerpt: "Buku pedoman teknis penyusunan target aksi dan kebijakan berbasis rendah karbon nasional.",
        image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09",
        category: "Ekonomi Hijau",
        author: "Tim Pembangunan Tematik",
        date: "15 Juni 2026",
        documentUrl: "https://bappenas.go.id/files/panduan-ekonomi-hijau.pdf",
        documentName: "Pedoman_Ekonomi_Hijau_2026.pdf",
        content: "<p>Transformasi menuju pembangunan ramah lingkungan menuntut standar baru dalam kerangka regulasi penganggaran baik pusat maupun daerah.</p><p>Buku ini memaparkan langkah praktis penilaian dampak lingkungan dari implementasi proyek infrastruktur strategis nasional.</p><p>Diterbitkan secara terbuka demi menyamakan standar evaluasi capaian target Net Zero Emission Indonesia.</p>"
      }
    ];

/* Re-export dengan alias (data asli pakai nama field HTML) */
/* units & publications sudah dideklarasikan `export const` di atas. */
/* portalImages bertipe Record<string,string> agar bisa di-index oleh unit.image. */
export const portalImages: Record<string, string> = IMAGE_DATA;
export { dashboards as externalDashboards };
export { news, services };

/* ===== Data turunan untuk komponen ===== */
export const externalLinks: ExternalLink[] = [
  { name: "Bappenas", url: "https://www.bappenas.go.id/", label: "https://www.bappenas.go.id/front_assets/img/logoc.png", status: "public" },
  { name: "Forum Masyarakat Statistik", url: "https://sites.google.com/view/web-fms/beranda", label: "https://drive.google.com/thumbnail?id=1rTPzAjEJ9mIcn7amiEBAJTWhtE5A2-ia&sz=w2000", status: "public" },
  { name: "Indonesia Emas 2045", url: "https://indonesia2045.go.id/", label: "https://drive.google.com/thumbnail?id=1Pr4uASZgSCBFj__gf9wI2rlz__snPM-8&sz=w2000", status: "public" },
  { name: "Perpustakaan PMP", url: "https://sites.google.com/view/perpustakaanpmp/home", label: "https://drive.google.com/thumbnail?id=14sTD4clEV5wzJyQshHTA192HTRqHmhlA&sz=w2000", status: "private" },
  { name: "Arthakarya", url: "https://remote.keuanganppn1.cloud/login", label: "https://drive.google.com/thumbnail?id=1JfEVFeFi6pT16rm_knsVDJFmczCqSynD&sz=w2000", status: "private" },
];

export const portalMenus: PortalMenuItem[] = [
  { name: "Beranda", path: "/", status: "public" },
  {
    name: "Profil",
    status: "public",
    children: units.map((unit) => ({ name: unit.name, path: "/profil/unit/" + unit.slug })),
  },
  {
    name: "Data",
    status: "public",
    children: [
      { name: "Berita", path: "/berita" },
      { name: "Publikasi", path: "/publikasi" },
    ],
  },
  {
    name: "Layanan",
    status: "public",
    children: services.map((s) => ({ name: s.name, path: "/layanan/" + s.slug })),
  },
  {
    name: "Dashboard",
    status: "private",
    children: dashboards.map((d) => ({ name: d.title, path: "/dashboard/" + d.slug })),
  },
];
