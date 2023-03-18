//untuk masalah routing akan disimpan di dalam file ini
const routes = (handler) => [
    {
        method: 'POST',
        path: '/notes',
        handler: handler.postNoteHandler,
    },
    {
        method: 'GET',
        path: '/notes',
        handler: handler.getNotesHandler,
    },
    {
        method: 'GET',
        path: '/notes/{id}',
        handler: handler.getNoteByIdHandler,
    },
    {
        method: 'PUT',
        path: '/notes/{id}',
        handler: handler.putNoteByIdHandler,
    },
    {
        method: 'DELETE',
        path: '/notes/{id}',
        handler: handler.deleteNoteByIdHandler,
    },
];

//untuk mengimport agar bisa digunakan server.js (kelas lain)
module.exports = routes;