/**
 * Skrip dashboard admin — versi ramping.
 *
 * Menggantikan main.js bawaan NiceAdmin, yang menginisialisasi TinyMCE,
 * Quill, ECharts, Chart.js, dan Datatables. Pustaka-pustaka itu tidak
 * dipakai di proyek ini dan file vendornya sudah dihapus, sehingga skrip
 * asli melempar "ReferenceError: tinymce is not defined" lalu berhenti —
 * ikut mematikan fungsi di bawahnya.
 *
 * Yang disisakan hanya yang benar-benar dipakai: tombol buka/tutup sidebar
 * dan tombol kembali ke atas. Keduanya vanilla JS, tanpa Bootstrap JS.
 */
(function () {
  "use strict";

  /* Sidebar: kelas .toggle-sidebar di <body> yang digeser oleh CSS template. */
  var toggleBtn = document.querySelector(".toggle-sidebar-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      document.body.classList.toggle("toggle-sidebar");
    });
  }

  /* Tombol kembali ke atas, muncul setelah menggulir cukup jauh. */
  var backToTop = document.querySelector(".back-to-top");
  if (backToTop) {
    var sync = function () {
      backToTop.classList.toggle("active", window.scrollY > 100);
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    backToTop.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();
