/* eslint-env jquery, browser */
$(document).ready(() => {

  $(document).ready( function () {
    $('#deviceTable').DataTable({
      "autoWidth": true,
      'columns': [
        null,
        null,
        null,
        null,
        null,
        {'orderable': false},
      ]
    });
  });

});
