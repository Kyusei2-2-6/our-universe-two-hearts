/* Pertanyaan Hari Ini untuk dua orang (Couple Connect).
   Jawaban disimpan sebagai baris pesan (kind=text, metadata.feature='qotd') di tabel couple_messages
   yang sudah ada, dan disembunyikan dari chat biasa. Tanpa perubahan database. */

const BANK={
  kenangan:['Kenangan kita yang paling sering kamu putar ulang di kepala?',
'Apa hal pertama yang kamu perhatikan dariku waktu kita mulai dekat?',
'Apa yang kamu rasakan saat pertama kali kita ngobrol lama?',
'Kapan kamu sadar kalau kamu mulai suka padaku?',
'Apa hal paling lucu yang pernah kita alami bersama?',
'Kalau bisa kembali ke satu hari bersamaku, kamu pilih hari yang mana?',
'Apa satu kebaikan kecil dariku yang masih kamu ingat?',
'Momen apa yang membuatmu yakin kita cocok?',
'Apa isi percakapan pertama kita yang masih kamu ingat?',
'Tempat apa yang paling berkesan buat kita berdua?',
'Lagu apa yang paling mengingatkanmu padaku, dan kenapa?',
'Foto kita yang mana yang paling kamu suka?',
'Apa hal tak terduga yang kamu pelajari tentang aku setelah kita dekat?',
'Hari biasa apa yang ternyata jadi kenangan indah buat kamu?',
'Kapan terakhir kali kita tertawa lepas bareng?',
'Apa yang pertama kali bikin kamu penasaran denganku?',
'Kejutan terbaik apa yang pernah kamu terima dariku?',
'Apa janji kecil dariku yang paling berarti buatmu?',
'Waktu kita paling kompak itu kapan?',
'Kapan kamu merasa paling bangga padaku?',
'Apa yang kamu ingat dari malam kita pertama bertukar pesan panjang?',
'Pesan dariku yang mana yang pernah kamu baca berulang-ulang?',
'Apa kenangan kecil yang kamu simpan diam-diam tentang kita?',
'Apa yang membuatmu tersenyum waktu mengingat awal kita?',
'Momen kapan kamu merasa kita benar-benar dekat?',
'Apa kenangan kita yang ingin kamu ulang persis sama?',
'Apa hal yang dulu kamu pikir tentangku dan ternyata salah?',
'Apa yang ingin kamu ingat dari tahun ini suatu hari nanti?',
'Apa hal terkecil dariku yang ternyata paling kamu kenang?',
'Hari mana yang rasanya paling lama kamu tunggu bareng aku?',
'Apa yang membuatmu merasa kita sudah melewati banyak hal bersama?'],
  perasaan:['Kapan kamu merasa paling dicintai?',
'Apa hal yang bikin kamu merasa tenang saat bersamaku?',
'Apa yang membuat kamu merasa dimengerti?',
'Apa yang membuatmu merasa aman?',
'Apa yang biasanya kamu lakukan saat sedang kangen?',
'Apa yang ingin kamu dengar dariku hari ini?',
'Apa satu hal yang ingin kamu ucapkan padaku tapi belum sempat?',
'Bagaimana caramu paling suka diberi semangat saat lelah?',
'Apa ketakutan kecil yang ingin kamu ceritakan padaku?',
'Kata apa yang paling pas menggambarkan kita?',
'Apa yang paling kamu syukuri dari hubungan kita?',
'Apa hal yang kamu harap lebih sering kita lakukan berdua?',
'Apa yang membuatmu jatuh hati pada hal-hal kecil di hubungan ini?',
'Kapan kamu merasa paling dekat denganku meski kita berjauhan?',
'Apa yang membuatmu merasa diperhatikan?',
'Bagaimana caramu menunjukkan sayang tanpa kata-kata?',
'Apa yang biasanya bikin kamu diam, dan apa yang kamu butuhkan saat itu?',
'Apa yang bikin kamu merasa dihargai?',
'Kapan kamu merasa paling nyaman jadi diri sendiri bersamaku?',
'Apa hal yang kamu harap aku tahu tentang perasaanmu?',
'Bagaimana kamu ingin kita menyelesaikan salah paham?',
'Apa yang membuatmu merasa rindu padaku?',
'Seberapa sering kamu memikirkanku, dan biasanya saat apa?',
'Apa hal yang membuatmu merasa kita satu tim?',
'Ucapan apa yang paling bikin hatimu hangat?',
'Apa yang kamu butuhkan dariku saat sedang berat?',
'Hal apa yang bikin kamu terharu belakangan ini?',
'Apa yang membuatmu merasa kita saling melengkapi?',
'Kapan terakhir kali kamu merasa bersyukur punya aku?',
'Apa hal yang kamu pelajari tentang cinta dari kita?',
'Pelukan seperti apa yang paling kamu butuhkan saat ini?'],
  masa_depan:['Tempat mana yang ingin kamu kunjungi bersamaku suatu hari nanti?',
'Mimpi apa yang ingin kamu capai dalam setahun ke depan?',
'Kalau kita bisa tinggal di mana saja, kamu ingin di mana?',
'Hal apa yang ingin kamu coba untuk pertama kalinya bersamaku?',
'Apa yang ingin kamu lakukan di ulang tahun kita nanti?',
'Hobi baru apa yang ingin kita pelajari bersama?',
'Apa satu janji kecil yang ingin kamu buat untuk kita?',
'Kalau kita menulis surat untuk diri kita setahun lagi, kamu mau bilang apa?',
'Seperti apa rumah impian kita menurutmu?',
'Apa pesan yang ingin kamu titipkan untuk dirimu sendiri sepuluh tahun lagi?',
'Apa hal baik yang ingin kamu lihat terjadi minggu depan?',
'Apa tujuan kecil yang ingin kita capai bareng bulan ini?',
'Perjalanan seperti apa yang kamu bayangkan untuk kita?',
'Apa yang ingin kamu pelajari dalam waktu dekat?',
'Bagaimana kamu membayangkan hari tua kita?',
'Apa kebiasaan baik yang ingin kita bangun bersama?',
'Apa yang ingin kamu wujudkan sebelum tahun ini berakhir?',
'Kalau punya modal tak terbatas, apa yang pertama kali ingin kamu lakukan untuk kita?',
'Apa tradisi kecil yang ingin kita punya?',
'Kota mana yang ingin kamu jelajahi bareng aku?',
'Apa yang ingin kamu ingat dari hari ini sepuluh tahun lagi?',
'Pekerjaan atau karya apa yang ingin kamu banggakan nanti?',
'Apa satu hal yang ingin kita lakukan sebelum usia tertentu?',
'Apa yang ingin kamu ubah dari rutinitasmu supaya hidup lebih tenang?',
'Dalam setahun ke depan, apa yang paling ingin kamu syukuri?',
'Apa kejutan yang ingin kamu siapkan untukku suatu hari nanti?',
'Seperti apa pagi sempurna kita kelak?',
'Apa hal kecil yang ingin kamu mulai minggu ini?',
'Apa yang ingin kamu katakan pada dirimu yang sekarang di lima tahun lagi?',
'Kalau hidup kita dibuat jadi film, adegan apa yang ingin kamu tambahkan?',
'Apa yang ingin kamu lakukan di liburan berikutnya bareng aku?'],
  keseharian:['Momen kecil apa dari hari ini yang bikin kamu tersenyum?',
'Apa rutinitas pagi yang paling bikin kamu semangat?',
'Kebiasaan kecilku apa yang diam-diam kamu suka?',
'Hal sederhana apa yang selalu bikin harimu membaik?',
'Apa yang kamu lakukan pertama kali setelah bangun tidur?',
'Hal apa yang bikin kamu lelah belakangan ini?',
'Apa yang kamu nikmati dari malam hari?',
'Apa yang biasanya kamu dengarkan saat sedang sendirian?',
'Bagaimana harimu kalau dinilai dari 1 sampai 10, dan kenapa?',
'Hal kecil apa yang bisa kulakukan supaya harimu terasa lebih ringan?',
'Apa yang kamu makan hari ini dan apakah enak?',
'Apa yang membuat kamu tertawa hari ini?',
'Apa yang paling ingin kamu istirahatkan hari ini?',
'Apa hal yang kamu tunda dan ingin kamu selesaikan?',
'Apa satu hal baik yang terjadi hari ini?',
'Kalau hari ini bisa diulang, bagian mana yang ingin kamu ulang?',
'Apa yang bikin kamu semangat bangun besok?',
'Apa yang kamu pikirkan sebelum tidur semalam?',
'Kebiasaan apa yang paling sering kamu lakukan tanpa sadar?',
'Apa tempat favoritmu di rumah?',
'Apa yang kamu butuhkan supaya akhir pekan terasa utuh?',
'Apa yang kamu sukai dari cuaca hari ini?',
'Bagaimana kamu menenangkan diri saat cemas?',
'Apa kegiatan yang membuatmu lupa waktu?',
'Apa yang kamu rindukan dari suasana sore?',
'Kalau punya satu jam kosong sekarang, apa yang kamu lakukan?',
'Apa pakaian ternyaman yang sering kamu pakai?',
'Apa yang kamu sukai dari akhir pekan kita?',
'Apa kegiatan sederhana yang ingin kita lakukan berdua malam ini?',
'Apa yang membuat harimu terasa cukup?',
'Apa hal kecil yang membuatmu bangga hari ini?'],
  seru:['Kalau perjalanan kita ini sebuah film, apa judulnya?',
'Kalau aku jadi karakter dongeng, kira-kira aku siapa?',
'Kalau kita punya hewan peliharaan bareng, apa dan siapa namanya?',
'Kalau punya satu keajaiban kecil untuk kita berdua, apa itu?',
'Kalau kamu bisa punya satu kekuatan super, apa dan buat apa?',
'Kalau kita tukar hidup sehari, apa yang pertama kamu lakukan?',
'Kalau kita terdampar di pulau, barang apa yang kamu bawa?',
'Kalau kita membuka kafe bareng, apa namanya dan menu andalannya?',
'Kalau bisa makan satu makanan seumur hidup, apa pilihanmu?',
'Kalau bisa bertemu dirimu waktu kecil, apa yang kamu katakan?',
'Kalau kita jadi duo detektif, siapa yang jadi apa?',
'Kalau kamu menulis buku tentang kita, apa judul bab pertamanya?',
'Kalau kita punya band, kita main genre apa?',
'Kalau seharian kamu jadi aku, apa yang pertama kamu lakukan?',
'Kalau hari ini punya warna langit, langit seperti apa?',
'Kalau bisa teleport sekarang, kamu mau ke mana bareng aku?',
'Kalau ada mesin waktu, kamu pilih masa lalu atau masa depan?',
'Kalau kamu bisa memberi kita satu julukan baru, apa?',
'Kalau kita punya acara TV sendiri, apa temanya?',
'Kalau kita bisa mengundang tiga orang ke makan malam, siapa mereka?',
'Kalau dunia tinggal satu hari, apa yang kamu lakukan bersamaku?',
'Kalau kamu jadi hewan, hewan apa dan kenapa?',
'Kalau bisa menguasai satu keahlian instan, apa yang kamu pilih?',
'Kalau ada tombol ulang untuk satu momen, momen apa?',
'Kalau kita punya rumah pohon, apa isi di dalamnya?',
'Kalau kamu jadi menteri satu hari, aturan lucu apa yang kamu buat?',
'Kalau kita bikin tradisi baru setiap Minggu, apa itu?',
'Kalau kamu bisa ngobrol dengan satu tokoh, siapa dan apa yang kamu tanyakan?',
'Kalau kamu bisa menamai satu bintang untuk kita, namanya apa?',
'Kalau semua orang bisa membaca pikiranmu hari ini, apa yang paling memalukan?',
'Kalau kita jadi penjelajah antariksa, planet pertama kita beri nama apa?'],
  syukur:['Sebutkan tiga hal yang kamu syukuri minggu ini.',
'Apa yang membuatmu bangga pada dirimu minggu ini?',
'Apa hal baik kecil yang terjadi padamu kemarin?',
'Siapa orang yang paling kamu syukuri selain aku, dan kenapa?',
'Apa yang kamu syukuri dari tubuhmu hari ini?',
'Apa hal yang dulu sulit dan sekarang kamu syukuri?',
'Apa kebaikan yang ingin kamu balas pada seseorang?',
'Apa yang kamu syukuri dari rumahmu?',
'Apa pelajaran dari kesalahan yang sekarang kamu syukuri?',
'Apa yang kamu syukuri dari pekerjaan atau sekolahmu?',
'Apa yang ingin kamu ucapkan terima kasih hari ini?',
'Makanan apa yang selalu bikin kamu bersyukur?',
'Apa kemudahan kecil yang jarang kamu sadari?',
'Siapa yang diam-diam menolongmu belakangan ini?',
'Apa hal baru yang kamu syukuri bulan ini?',
'Apa yang kamu syukuri dari teman-temanmu?',
'Apa yang kamu syukuri dari kesehatanmu?',
'Apa berkat tak terduga yang kamu terima tahun ini?',
'Apa yang kamu syukuri dari keluargamu?',
'Suara apa yang paling kamu syukuri bisa kamu dengar?',
'Apa yang kamu syukuri dari kota atau tempat tinggalmu?',
'Apa yang kamu syukuri dari cuaca hari ini?',
'Apa hal yang membuatmu merasa cukup?',
'Apa yang kamu syukuri dari perjalanan hidupmu sejauh ini?',
'Apa hal sederhana yang ingin kamu rayakan hari ini?',
'Apa yang kamu syukuri dari tidurmu semalam?',
'Apa pencapaian kecil yang ingin kamu rayakan bersamaku?',
'Apa yang kamu syukuri dari dirimu dua tahun lalu?',
'Sifat baik apa dalam dirimu yang kamu syukuri?',
'Apa yang ingin kamu pertahankan dari hidupmu sekarang?'],
  pilih:['Pilih mana: pantai atau gunung, dan kenapa?',
'Pilih mana: pagi hari atau malam hari?',
'Pilih mana: kopi, teh, atau cokelat panas?',
'Pilih mana: liburan ramai atau liburan sepi?',
'Pilih mana: kirim pesan panjang atau telepon singkat?',
'Pilih mana: kejutan atau rencana matang?',
'Pilih mana: hujan atau cerah untuk kencan kita?',
'Pilih mana: masak bareng atau makan di luar?',
'Pilih mana: film di rumah atau jalan-jalan keluar?',
'Pilih mana: buku atau musik untuk menemani sore?',
'Pilih mana: kucing atau anjing?',
'Pilih mana: kota ramai atau desa tenang?',
'Pilih mana: pelukan lama atau genggaman tangan?',
'Pilih mana: hadiah buatan sendiri atau hadiah yang dibeli?',
'Pilih mana: pagi tanpa alarm atau malam tanpa jadwal?',
'Pilih mana: jalan kaki berdua atau naik motor santai?',
'Pilih mana: dingin atau hangat?',
'Pilih mana: manis atau pedas?',
'Pilih mana: foto atau video untuk menyimpan kenangan?',
'Pilih mana: surat tulisan tangan atau pesan suara?',
'Pilih mana: piknik di taman atau menonton bintang?',
'Pilih mana: belajar hal baru atau mengulang hal yang kamu suka?',
'Pilih mana: kamar rapi atau kamar nyaman berantakan?',
'Pilih mana: tidur cepat atau begadang ngobrol?',
'Pilih mana: lagu lama atau lagu baru?',
'Pilih mana: berani mencoba atau memilih aman?',
'Pilih mana: waktu sendiri atau waktu berdua setelah hari yang berat?',
'Pilih mana: bunga atau makanan favorit?',
'Pilih mana: matahari terbit atau matahari terbenam?',
'Pilih mana: ngobrol serius atau bercanda tengah malam?'],
  diri:['Hal apa dari masa kecilmu yang ingin kamu ceritakan padaku?',
'Apa mainan atau kegiatan favoritmu waktu kecil?',
'Apa mimpimu waktu kecil dan apa yang berubah?',
'Apa yang kamu pelajari tentang dirimu sendiri sejak mengenalku?',
'Apa kebiasaan lamamu yang ingin kamu tinggalkan?',
'Apa kebiasaan baikmu yang ingin kamu pertahankan?',
'Apa hal tentang dirimu yang baru kamu sadari belakangan?',
'Apa yang bikin kamu merasa paling percaya diri?',
'Apa hal yang membuatmu gugup, dan bagaimana kamu menghadapinya?',
'Siapa panutanmu waktu kecil, dan kenapa?',
'Apa kenangan masa sekolah yang paling kamu ingat?',
'Apa kelebihanmu yang jarang kamu akui?',
'Apa hal yang ingin kamu maafkan dari dirimu sendiri?',
'Apa hal yang paling kamu sukai dari kepribadianmu?',
'Apa yang membuatmu merasa pulang?',
'Apa makanan masa kecil yang bikin kamu rindu?',
'Apa yang kamu sukai dari dirimu saat sedang tenang?',
'Apa pelajaran terbesar yang kamu dapat dari tahun lalu?',
'Apa kesalahan yang justru mengajarimu banyak hal?',
'Apa yang membuatmu merasa kuat?',
'Apa yang kamu harap orang lain tahu tentangmu?',
'Apa yang kamu lakukan saat merasa kecil dan ingin bangkit?',
'Apa yang kamu sukai dari kota tempat kamu tumbuh?',
'Apa kenangan keluargamu yang paling hangat?',
'Apa yang ingin kamu ceritakan tentang sahabat terdekatmu?',
'Apa cita-cita yang tidak pernah kamu ceritakan?',
'Apa nasihat terbaik yang pernah kamu dapat?',
'Apa yang kamu lakukan ketika merasa sendirian?',
'Apa kebiasaan anehmu yang ingin kamu akui?',
'Apa satu hal yang ingin kamu pelajari tentang dirimu bulan ini?'],
  hobi:['Makanan apa yang ingin kamu makan atau masak bareng aku?',
'Film atau series apa yang ingin kamu tonton bareng aku?',
'Lagu apa yang sedang sering kamu putar belakangan ini?',
'Buku atau cerita apa yang ingin kamu baca bersamaku?',
'Apa minuman favoritmu saat suasana hati sedang baik?',
'Game atau permainan apa yang ingin kamu mainkan bareng aku?',
'Apa jajanan yang ingin kamu bagi denganku?',
'Resep apa yang ingin kamu kuasai?',
'Apa podcast, video, atau kanal yang kamu suka?',
'Apa aktivitas luar ruangan yang ingin kamu coba?',
'Warna apa yang menggambarkan perasaanmu hari ini?',
'Apa tempat makan favoritmu yang ingin kamu kenalkan padaku?',
'Apa hobi yang bikin kamu lupa waktu?',
'Apa lagu yang ingin kamu nyanyikan bersamaku?',
'Apa tradisi keluargamu yang ingin kamu bagi?',
'Apa kegiatan akhir pekan yang ingin kita jadikan kebiasaan?',
'Apa warna atau tempat yang membuatmu merasa tenang?',
'Apa kata atau ungkapan favoritmu akhir-akhir ini?',
'Apa kerajinan atau karya yang ingin kita buat bersama?',
'Apa aroma yang mengingatkanmu pada rumah atau padaku?',
'Apa acara yang ingin kamu hadiri bersamaku?',
'Apa olahraga atau gerakan ringan yang ingin kita coba?',
'Apa tanaman atau bunga yang ingin kita rawat?',
'Apa barang yang sedang ingin kamu beli, dan kenapa?',
'Apa kegiatan yang membuatmu merasa hidup?',
'Apa menu sarapan yang ingin kamu nikmati bersamaku?',
'Apa tempat nongkrong yang ingin kita jadikan langganan?',
'Apa alat musik atau bakat yang ingin kamu pelajari?',
'Apa barang kecil di rumahmu yang punya cerita?',
'Apa permainan masa kecil yang ingin kamu ajarkan padaku?'],
  nilai:['Apa nilai yang paling penting bagimu dalam sebuah hubungan?',
'Apa arti kesetiaan bagimu?',
'Bagaimana kamu ingin kita saling mendukung saat gagal?',
'Apa yang kamu pikirkan tentang kejujuran dalam hubungan?',
'Apa arti rumah buatmu?',
'Apa aturan sederhana yang ingin kita pegang bersama?',
'Apa arti bahagia buatmu?',
'Apa arti sukses buatmu, dan bagaimana kita bisa mendukungnya?',
'Bagaimana kamu memaknai kata maaf?',
'Apa yang kamu butuhkan supaya merasa dipercaya?',
'Bagaimana kamu ingin kita membagi waktu untuk diri sendiri dan bersama?',
'Apa arti keluarga bagimu?',
'Apa yang kamu pikirkan tentang berjuang bersama?',
'Apa yang membuatmu memilih bertahan saat sulit?',
'Bagaimana kamu ingin diingat oleh orang yang kamu sayangi?',
'Apa hal yang tidak mau kamu kompromikan?',
'Apa arti sabar bagimu?',
'Apa yang membuatmu percaya pada kita?',
'Bagaimana kamu ingin kita menghadapi perbedaan pendapat?',
'Apa prinsip hidup yang ingin kamu wariskan?',
'Apa arti waktu berkualitas menurutmu?',
'Apa arti rasa aman dalam sebuah hubungan?',
'Bagaimana caramu memaafkan?',
'Apa yang kamu pikirkan tentang rezeki dan rasa cukup?',
'Apa arti persahabatan di dalam hubungan kita?',
'Bagaimana kamu ingin kita merayakan keberhasilan satu sama lain?',
'Apa dukungan yang paling nyata menurutmu?',
'Apa yang ingin kamu pelajari tentang kesabaran dari kita?',
'Apa arti keberanian bagimu?',
'Apa yang membuatmu merasa hubungan ini sehat?'],
  romantis:['Apa satu hal yang kamu kagumi dari caraku menjalani hidup?',
'Apa pesan yang ingin kamu titipkan untukku hari ini?',
'Hal apa dariku yang membuatmu tersenyum tanpa sadar?',
'Apa yang kamu harap aku tahu tentang betapa berartinya aku buatmu?',
'Apa hal kecil dariku yang membuatmu jatuh cinta lagi?',
'Kalau kamu menulis satu baris di buku harian kita, apa isinya?',
'Apa yang membuatmu rindu suaraku?',
'Apa kata-kata manis yang paling ingin kamu dengar?',
'Apa yang kamu suka dari caraku memandangmu?',
'Apa yang ingin kamu lakukan untuk membuatku bahagia hari ini?',
'Apa yang membuatku istimewa di matamu?',
'Apa yang ingin kamu bisikkan padaku malam ini?',
'Apa hal romantis sederhana yang kamu inginkan dari kita?',
'Apa julukan kesayangan yang paling kamu suka dariku?',
'Apa yang bikin kamu merasa aku rumahmu?',
'Apa yang paling kamu rindukan dari kebersamaan kita?',
'Apa yang membuatmu merasa beruntung memilikiku?',
'Apa yang ingin kamu peluk dariku sekarang juga?',
'Apa yang ingin kamu lakukan jika kita bertemu hari ini?',
'Apa cara terbaik untuk membuatmu merasa disayang?',
'Apa yang kamu kagumi dari senyumku?',
'Apa yang paling ingin kamu tulis dalam surat cinta untukku?',
'Apa momen kecil yang ingin kamu ulang bersamaku?',
'Apa yang bikin kamu salah tingkah di dekatku?',
'Apa yang kamu rasakan saat melihat namaku di layar ponselmu?',
'Apa yang ingin kamu katakan tentang kita pada dunia?',
'Lagu cinta apa yang ingin kamu dedikasikan untukku?',
'Apa yang bikin kamu merasa dicintai tanpa syarat?',
'Apa doa kecil yang kamu panjatkan untuk kita?',
'Apa alasan terbesarmu untuk tetap memilihku?'],
  tantangan:['Apa tiga kata yang menggambarkan aku menurutmu?',
'Ceritakan satu hal yang belum pernah kamu ceritakan padaku.',
'Tebak: makanan favoritku apa, dan kenapa menurutmu begitu?',
'Tebak: lagu yang sedang kuputar hari ini apa?',
'Tuliskan satu kalimat pujian untukku yang belum pernah kamu ucapkan.',
'Apa satu hal yang ingin kamu tanyakan padaku tapi belum pernah?',
'Sebutkan satu kebiasaanmu yang menurutmu bakal bikin aku tertawa.',
'Apa tiga hal favoritmu yang mungkin belum kuketahui?',
'Ceritakan mimpi aneh terakhir yang kamu ingat.',
'Tebak: apa yang sedang kupikirkan sekarang?',
'Apa lelucon andalanmu?',
'Apa hal terbaik yang kamu lakukan untuk orang lain minggu ini?',
'Sebutkan lima hal yang membuatmu bahagia dalam satu menit.',
'Emoji apa yang paling menggambarkan harimu sekarang, dan kenapa?',
'Tuliskan tiga hal yang ingin kamu lakukan akhir pekan ini.',
'Apa hal baru yang kamu coba minggu ini?',
'Apa kata baru atau ungkapan lucu yang kamu temukan belakangan ini?',
'Kirim padaku satu kalimat penyemangat untuk besok pagi.',
'Apa rahasia kecil yang ingin kamu bagikan hari ini?',
'Ceritakan satu hal konyol yang pernah kamu lakukan.',
'Tebak: apa yang bikin aku paling semangat?',
'Apa tiga hal yang kamu sukai dari hari Minggu?',
'Apa kegiatan yang ingin kamu ajarkan padaku?',
'Apa yang ingin kamu tanyakan pada dirimu sendiri setahun lalu?',
'Gambarkan hubungan kita dengan satu emoji dan satu kata.',
'Pertanyaan apa yang ingin kamu masukkan ke daftar pertanyaan hari ini?',
'Sebutkan satu hal yang kamu pelajari dariku.',
'Apa kata sandi rahasia untuk kita berdua, dan artinya?',
'Apa keputusan kecil yang kamu syukuri minggu ini?',
'Apa hal yang ingin kamu lihat aku coba?',
'Tulis satu kalimat tentang hari ini seperti judul film.']
};

/* Selang-seling antar kategori supaya tema berganti setiap hari (kenangan, perasaan, masa depan, dst.). */
function interleave(groups){
  const lists=Object.values(groups),out=[];
  for(let i=0;i<Math.max(...lists.map(list=>list.length));i++)for(const list of lists)if(i<list.length)out.push(list[i]);
  return out;
}

/* Sebarkan pembuka kalimat yang sama (mis. "Apa yang ...") agar tidak muncul berdekatan. Deterministik, jadi urutannya
   sama persis di kedua HP. */
function spread(list){
  const out=[...list],opener=q=>q.split(' ').slice(0,2).join(' ');
  for(let i=1;i<out.length;i++){
    const recent=[opener(out[i-1]),i>1?opener(out[i-2]):''];
    if(!recent.includes(opener(out[i])))continue;
    const j=out.findIndex((q,k)=>k>i&&!recent.includes(opener(q)));
    if(j>0){const[item]=out.splice(j,1);out.splice(i,0,item);}
  }
  return out;
}
export const QUESTIONS=spread(interleave(BANK));

const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
export const MAX_ANSWER=500;

export function dayKey(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
function dayNumber(key){const[y,m,d]=key.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);}
export function shiftDay(key,delta){const t=new Date((dayNumber(key)+delta)*86400000);return t.toISOString().slice(0,10);}
export function questionFor(key){return QUESTIONS[((dayNumber(key)%QUESTIONS.length)+QUESTIONS.length)%QUESTIONS.length];}
export function formatDay(key){
  const[y,m,d]=key.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long'}).format(new Date(Date.UTC(y,m-1,d)));
}

export function isQuestionRow(row){
  const meta=row?.metadata;
  return Boolean(meta&&meta.feature==='qotd'&&meta.type==='answer');
}

function compareRows(a,b){
  const left=String(a.created_at||''),right=String(b.created_at||'');
  if(left!==right)return left<right?-1:1;
  return String(a.id||'')<String(b.id||'')?-1:String(a.id||'')>String(b.id||'')?1:0;
}

/* Murni: baris -> { 'YYYY-MM-DD': {question, answers:{userId:{text,at,id}}} }.
   Hanya jawaban PERTAMA setiap orang untuk setiap hari yang dihitung. */
export function buildDays(rows){
  const days={};
  for(const row of[...rows].filter(isQuestionRow).sort(compareRows)){
    const meta=row.metadata,date=meta.date,text=typeof meta.answer==='string'?meta.answer.trim():'';
    if(!DATE_RE.test(String(date))||!text||text.length>MAX_ANSWER||!row.sender_id)continue;
    const day=days[date]||(days[date]={question:'',answers:{}});
    if(day.answers[row.sender_id])continue;
    day.answers[row.sender_id]={text,at:row.created_at||null,id:row.id||null};
    if(!day.question)day.question=typeof meta.question==='string'&&meta.question?meta.question.slice(0,240):questionFor(date);
  }
  return days;
}

export function bothAnswered(day,ids){return Boolean(day&&ids.length===2&&ids.every(id=>day.answers[id]));}

/* Berapa hari berturut-turut kalian berdua menjawab. Hari ini yang belum lengkap tidak memutus rangkaian. */
export function computeStreak(days,today,ids){
  let count=0,key=bothAnswered(days[today],ids)?today:shiftDay(today,-1);
  while(bothAnswered(days[key],ids)){count++;key=shiftDay(key,-1);}
  return count;
}

/* ---------------- Tampilan ---------------- */
let cssPromise=null;
function ensureStyles(){
  if(cssPromise)return cssPromise;
  cssPromise=new Promise(resolve=>{
    const link=document.createElement('link');link.rel='stylesheet';
    link.href=new URL('../../css/daily-question.css?v=4.9.9',import.meta.url).href;
    link.onload=()=>resolve();link.onerror=()=>resolve();
    document.head.append(link);setTimeout(resolve,1800);
  });
  return cssPromise;
}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
const DRAFT_PREFIX='ou:qotd-draft:';
function readDraft(key){try{return localStorage.getItem(DRAFT_PREFIX+key)||'';}catch{return '';}}
function writeDraft(key,value){try{if(value)localStorage.setItem(DRAFT_PREFIX+key,value);else localStorage.removeItem(DRAFT_PREFIX+key);}catch{}}

export function createDailyQuestion({getContext,load,send,toast=()=>{},onChange,now=()=>new Date()}){
  let rows=[],ids=new Set(),days={},root=null,els=null,opened=false,busy=false,escapeBound=false,shown=14;
  const me=()=>getContext();
  const today=()=>dayKey(now());
  // Pertanyaan sebuah hari: jika salah satu sudah menjawab, pakai teks yang tersimpan di jawabannya (supaya keduanya menjawab hal yang sama
  // walau daftar pertanyaan berubah di tengah hari); jika belum ada, ambil dari daftar.
  const questionOf=key=>days[key]?.question||questionFor(key);
  const players=()=>{const ctx=me();return[ctx.userId,ctx.partnerId].filter(Boolean);};

  function recompute(){days=buildDays(rows);}
  function ingest(input){
    let added=false;
    for(const row of Array.isArray(input)?input:[input]){
      if(!row||!isQuestionRow(row)||ids.has(row.id))continue;
      ids.add(row.id);rows.push(row);added=true;
    }
    if(!added)return;
    recompute();
    if(opened)render();
    onChange?.();
  }
  function reset(){rows=[];ids=new Set();days={};busy=false;close();onChange?.();}
  const needsMyAnswer=()=>{const ctx=me();return Boolean(ctx.userId&&ctx.partnerId&&!days[today()]?.answers[ctx.userId]);};
  const partnerAnsweredToday=()=>{const ctx=me();return Boolean(days[today()]?.answers[ctx.partnerId]);};

  function nameOf(id){const ctx=me();return id===ctx.userId?'Kamu':(ctx.partnerName||'Pasanganmu');}

  function buildUI(){
    root=el('section','dq-overlay');root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Pertanyaan hari ini');root.setAttribute('data-capture-ignore','true');
    const head=el('header','dq-head');
    const title=el('div','dq-title');title.append(el('h2','','💭 Pertanyaan Hari Ini'));const date=el('small','');title.append(date);
    const close=el('button','icon-button dq-close','×');close.type='button';close.setAttribute('aria-label','Tutup');close.onclick=()=>closeUI();
    head.append(title,close);
    const main=el('div','dq-main');
    const streak=el('div','dq-streak');streak.hidden=true;
    const card=el('article','dq-card');const q=el('p','dq-question');card.append(el('span','dq-eyebrow','Untuk kita berdua'),q);
    const form=el('form','dq-form');
    const area=el('textarea','dq-input');area.maxLength=MAX_ANSWER;area.rows=4;area.placeholder='Tulis jawabanmu dengan jujur…';area.setAttribute('aria-label','Jawabanmu');
    const row=el('div','dq-form-row');const count=el('small','dq-count','0/'+MAX_ANSWER);
    const submit=el('button','button button--primary dq-submit','Kirim jawaban');submit.type='submit';row.append(count,submit);form.append(area,row);
    const answers=el('div','dq-answers');
    const historyHead=el('h3','dq-history-title','Hari-hari sebelumnya');
    const history=el('div','dq-history');
    const more=el('button','button button--ghost dq-more','Lihat lebih banyak');more.type='button';
    main.append(streak,card,form,answers,historyHead,history,more);root.append(head,main);
    area.addEventListener('input',()=>{count.textContent=`${area.value.length}/${MAX_ANSWER}`;writeDraft(today(),area.value);});
    form.onsubmit=event=>{event.preventDefault();submitAnswer();};
    more.onclick=()=>{shown+=14;render();};
    els={date,streak,q,form,area,submit,count,answers,historyHead,history,more};
    document.body.append(root);
    if(!escapeBound){document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.stopPropagation();closeUI();}},true);escapeBound=true;}
  }

  function answerCard(label,text,mine){
    const card=el('div',`dq-answer${mine?' is-mine':''}`);card.append(el('small','',label),el('p','',text));return card;
  }

  function render(){
    if(!root)return;
    const ctx=me(),key=today(),day=days[key],myAnswer=day?.answers[ctx.userId],theirAnswer=day?.answers[ctx.partnerId];
    els.date.textContent=formatDay(key);
    els.q.textContent=questionOf(key);
    const streak=computeStreak(days,key,players());
    els.streak.hidden=streak<1;els.streak.textContent=`🔥 ${streak} hari berturut-turut menjawab bersama`;
    els.form.hidden=Boolean(myAnswer);
    els.submit.disabled=busy;els.area.disabled=busy;
    els.answers.replaceChildren();
    if(myAnswer){
      els.answers.append(answerCard('Jawabanmu',myAnswer.text,true));
      if(theirAnswer)els.answers.append(answerCard(`Jawaban ${ctx.partnerName||'pasanganmu'}`,theirAnswer.text,false));
      else{const wait=el('div','dq-wait','⏳ Dia belum menjawab. Kamu akan dapat pemberitahuan saat dia menjawab.');els.answers.append(wait);}
    }else if(theirAnswer){
      els.answers.append(el('div','dq-lock','🔒 Dia sudah menjawab! Tulis jawabanmu dulu untuk membukanya.'));
    }
    const past=Object.keys(days).filter(k=>k<key).sort().reverse();
    const mineAnswered=k=>Boolean(days[k].answers[ctx.userId]);
    els.history.replaceChildren(...past.slice(0,shown).map(k=>{
      const d=days[k],item=el('article','dq-past');
      item.append(el('small','dq-past-date',formatDay(k)),el('p','dq-past-q',d.question||questionFor(k)));
      const mine=d.answers[ctx.userId],theirs=d.answers[ctx.partnerId];
      if(mine)item.append(answerCard('Kamu',mine.text,true));
      if(theirs){
        if(mineAnswered(k))item.append(answerCard(ctx.partnerName||'Pasanganmu',theirs.text,false));
        else item.append(el('div','dq-lock','🔒 Dia menjawab hari itu. Kamu belum, jadi jawabannya tetap terkunci.'));
      }
      if(!mine&&!theirs)item.append(el('div','dq-wait','Belum ada yang menjawab.'));
      return item;
    }));
    els.historyHead.hidden=past.length===0;els.more.hidden=past.length<=shown;
  }

  async function submitAnswer(){
    if(busy)return;
    const ctx=me(),key=today(),text=els.area.value.trim();
    if(!ctx.partnerId)return;
    if(days[key]?.answers[ctx.userId])return;
    if(!text){toast('Tulis jawabanmu dulu.',{type:'error'});return;}
    busy=true;render();
    const body=partnerAnsweredToday()?'💭 Pertanyaan hari ini: jawaban kita sudah terbuka, ayo lihat!':'💭 Pertanyaan hari ini: aku sudah menjawab, giliranmu!';
    try{
      const row=await send({feature:'qotd',type:'answer',date:key,question:questionOf(key),answer:text},body);
      writeDraft(key,'');els.area.value='';els.count.textContent='0/'+MAX_ANSWER;
      busy=false;ingest(row);
    }catch(error){
      toast(String(error?.message||'').match(/fetch|network/i)?'Koneksi terputus. Jawabanmu belum terkirim, tulisannya aman, coba lagi.':'Jawaban belum terkirim. Tulisannya aman, coba lagi.',{type:'error',duration:6000});
    }finally{busy=false;if(opened)render();}
  }

  async function open(){
    if(!me().partnerId){toast('Pasanganmu belum bergabung.',{type:'error'});return;}
    await ensureStyles();
    if(!root)buildUI();
    opened=true;root.hidden=false;
    const draft=readDraft(today());if(draft&&!els.area.value){els.area.value=draft;els.count.textContent=`${draft.length}/${MAX_ANSWER}`;}
    render();
    try{ingest(await load());}catch(error){console.warn('Pertanyaan hari ini belum bisa memuat jawaban:',error);}
    if(opened)render();
  }
  function closeUI(){opened=false;if(root)root.hidden=true;}
  function close(){closeUI();}

  return{open,close,reset,ingest,isOpen:()=>opened,needsMyAnswer,partnerAnsweredToday,getDays:()=>days};
}
