/* Montevia — recherche dans la FAQ */

(function () {
  'use strict';

  function init() {
    var input = document.getElementById('faqSearch');
    if (!input) return;

    var items = document.querySelectorAll('.faq__item');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      items.forEach(function (item) {
        var text = item.textContent.toLowerCase();
        item.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();