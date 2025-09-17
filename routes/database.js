// database.js — compatible con los tests de FCC

// Crear hilo
const createThread = (document, res, boardName) => {
  document.save((err, data) => {
    if (err) return res.type('text').send('server error');
    // Los tests esperan REDIRECT y el parámetro ?_id=
    return res.redirect(`/b/${boardName}?_id=${data._id}`);
  });
};

// Listar 10 hilos más recientes con 3 replies c/u (sanitizado)
const showAll = (Board, res) => {
  Board.find({}, { replies: { $slice: -3 } }) // últimas 3 inserciones (más recientes)
    .sort({ bumped_on: -1 })
    .limit(10)
    .select('-delete_password -reported -replies.delete_password -replies.reported')
    .lean()
    .exec((err, docs) => {
      if (err) return res.type('text').send(err.message);

      // (Opcional) ordenar esas 3 por fecha asc para estabilidad visual
      (docs || []).forEach(t => {
        if (Array.isArray(t.replies)) {
          t.replies.sort((a, b) => new Date(a.created_on) - new Date(b.created_on));
        }
      });

      res.json(docs);
    });
};

// Reportar hilo
const reportThread = (Board, _id, res) => {
  const id = (_id || '').replace(/\s/g, '');
  Board.findByIdAndUpdate(
    id,
    { $set: { reported: true } },
    { new: true },
    (err, doc) => {
      if (err || !doc) return res.type('text').send('incorrect board or id');
      return res.type('text').send('reported');
    }
  );
};

// Borrar hilo
const deleteThread = (Board, _id, password, res) => {
  const id = (_id || '').replace(/\s/g, '');
  Board.findById(id, (err, doc) => {
    if (err || !doc) return res.type('text').send('incorrect board or id');
    if (doc.delete_password !== password) {
      return res.type('text').send('incorrect password');
    }
    Board.deleteOne({ _id: id }, err2 => {
      if (err2) return res.type('text').send('server error');
      return res.type('text').send('success');
    });
  });
};

// Crear reply → bump con el MISMO timestamp y REDIRECT con ?_id=<replyId>
const createPost = (Board, body, res, boardName) => {
  const now = new Date(); // MISMO valor para created_on y bumped_on
  Board.findOneAndUpdate(
    { _id: body.thread_id },
    {
      $push: { replies: { text: body.text, delete_password: body.delete_password, created_on: now } },
      $set: { bumped_on: now },
      $inc: { replycount: 1 }
    },
    { new: true }
  )
  .select('-replies.delete_password -replies.reported') // dejamos _id y created_on
  .exec((err, doc) => {
    if (err || !doc) return res.type('text').send('not found');
    const newReplyId = doc.replies[doc.replies.length - 1]._id;
    // Los tests esperan REDIRECT y que el query param sea _id=
    return res.redirect(`/b/${boardName}/${body.thread_id}?_id=${newReplyId}`);
  });
};

// Ver un hilo con TODAS sus replies (sanitizado) e incluir replycount
const showThread = (Board, _id, res) => {
  const id = (_id || '').replace(/\s/g, '');
  Board.findById(id)
    .select('-delete_password -reported -replies.delete_password -replies.reported')
    .lean()
    .exec((err, t) => {
      if (err) return res.type('text').send(err.message);
      if (!t) return res.type('text').send('incorrect board or id');

      const replies = (t.replies || []).slice().sort((a, b) => new Date(b.created_on) - new Date(a.created_on));
      // Devuelve replycount (los tests lo verifican)
      return res.json({
        _id: t._id,
        text: t.text,
        created_on: t.created_on,
        bumped_on: t.bumped_on,
        replycount: t.replycount || replies.length,
        replies
      });
    });
};

// Reportar reply
const reportPost = (Board, thread_id, post_id, res) => {
  const tid = (thread_id || '').replace(/\s/g, '');
  const pid = (post_id || '').replace(/\s/g, '');
  Board.updateOne(
    { _id: tid, 'replies._id': pid },
    { $set: { 'replies.$.reported': true } }
  ).exec((err, result) => {
    if (err) return res.type('text').send('incorrect board or id');
    const matched = result?.matchedCount ?? result?.n; // compat
    if (matched === 1) return res.type('text').send('reported');
    return res.type('text').send('incorrect board or id');
  });
};

// Borrar reply (texto = "[deleted]")
const deletePost = (Board, thread_id, post_id, password, res) => {
  const tid = (thread_id || '').replace(/\s/g, '');
  const pid = (post_id || '').replace(/\s/g, '');

  Board.findById(tid, (err, t) => {
    if (err || !t) return res.type('text').send('incorrect board or thread id');

    const r = t.replies.id(pid);
    if (!r) return res.type('text').send('incorrect post id');
    if (r.delete_password !== password) {
      return res.type('text').send('incorrect password');
    }

    r.text = '[deleted]';
    t.replycount = Math.max(0, (t.replycount || 0) - 1);

    t.save(err2 => {
      if (err2) return res.type('text').send('server error');
      return res.type('text').send('success');
    });
  });
};

exports.createThread = createThread;
exports.showAll = showAll;
exports.reportThread = reportThread;
exports.deleteThread = deleteThread;
exports.createPost = createPost;
exports.showThread = showThread;
exports.reportPost = reportPost;
exports.deletePost = deletePost;
