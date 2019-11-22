/* eslint-env jquery, browser */
$(document).ready(() => {
  $(document).ready(function() {
    $("#implantTable").DataTable({
      autoWidth: true,
      columns: [null, null, null, null, null, { orderable: false }]
    });
    $("#infrastructureTable").DataTable({
      autoWidth: true,
      columns: [null, null, null, null, null, null, { orderable: false }]
    });
    $("#fileTable").DataTable({
      autoWidth: true,
      columns: [null, { orderable: false }]
    });
  });
});
