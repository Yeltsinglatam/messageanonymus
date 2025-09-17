// database.js — versión compatible con los tests de FCC

// Crear hilo
const createThread = (document, res, boardName) => {
  document.save((err, data) => {
    if (err) return res.type("text").send("server error");
    // FCC no exige redirect; JSON ayuda a los tests
    return res.json({ _id: data._id, board: boardName });
    // Si prefieres el redirect de tu front, usa:
    // return res.redirect(`/b/${boardName}?_id=${data._id}`);
  });
};

// Listar 10 hilos más recientes con 3 replies c/u (sanitizado)
const showAll = (BoardModel, res) => {
  BoardModel.find({})
    .sort({ bumped_on: -1 })
    .limit(10)
    .lean()
    .exec((err, docs) => {
      if (err) return res.type("text").send("server error");

      const out = (docs || []).map((t) => {
        const replies = (t.replies || [])
          .sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
          .slice(0, 3)
          .map((r) => ({
            _id: r._id,
            text: r.text,
            created_on: r.created_on,
          }));
        return {
          _id: t._id,
          text: t.text,
          created_on: t.created_on,
          bumped_on: t.bumped_on,
          replies,
          replycount: (t.replies || []).length,
        };
      });

      res.json(out);
    });
};

// Reportar hilo
const reportThread = (BoardModel, _id, res) => {
  _id = _id.replace(/\s/g, "");
  BoardModel.findByIdAndUpdate(
    _id,
    { $set: { reported: true } },
    { new: true },
    (err, doc) => {
      if (err || !doc) return res.type("text").send("not found");
      return res.type("text").send("reported");
    }
  );
};

// Borrar hilo
const deleteThread = (BoardModel, _id, password, res) => {
  _id = _id.replace(/\s/g, "");
  BoardModel.findById(_id, (err, doc) => {
    if (err || !doc) return res.type("text").send("not found");
    if (doc.delete_password !== password) {
      return res.type("text").send("incorrect password");
    }
    BoardModel.deleteOne({ _id }, (err2) => {
      if (err2) return res.type("text").send("server error");
      return res.type("text").send("success");
    });
  });
};

// Crear respuesta (update bumped_on, replycount) → success
const createPost = (BoardModel, body, res /*, boardName */) => {
  BoardModel.findOneAndUpdate(
    { _id: body.thread_id },
    {
      $push: {
        replies: {
          text: body.text,
          delete_password: body.delete_password,
          created_on: new Date(),
        },
      },
      $set: { bumped_on: new Date() },
      $inc: { replycount: 1 },
    },
    { new: true },
    (err, doc) => {
      if (err || !doc) return res.type("text").send("not found");
      // FCC espera 'success'
      return res.type("text").send("success");
      // Si quisieras el redirect del front:
      // return res.redirect('/b/' + boardName + '/' + body.thread_id + '?reply_id=' + doc.replies[doc.replies.length - 1]._id);
    }
  );
};

// Ver un hilo completo con TODAS sus replies (sanitizado)
const showThread = (BoardModel, _id, res) => {
  _id = _id.replace(/\s/g, "");
  BoardModel.findById(_id)
    .lean()
    .exec((err, t) => {
      if (err || !t) return res.type("text").send("not found");

      const replies = (t.replies || [])
        .sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
        .map((r) => ({
          _id: r._id,
          text: r.text,
          created_on: r.created_on,
        }));

      return res.json({
        _id: t._id,
        text: t.text,
        created_on: t.created_on,
        bumped_on: t.bumped_on,
        replies,
      });
    });
};

// Reportar respuesta
const reportPost = (BoardModel, thread_id, post_id, res) => {
  post_id = post_id.replace(/\s/g, "");
  thread_id = thread_id.replace(/\s/g, "");

  BoardModel.findById(thread_id, (err, t) => {
    if (err || !t) return res.type("text").send("not found");
    const r = t.replies.id(post_id);
    if (!r) return res.type("text").send("not found");
    r.reported = true;
    t.save((err2) => {
      if (err2) return res.type("text").send("server error");
      return res.type("text").send("reported");
    });
  });
};

// Borrar respuesta (texto = "[deleted]")
const deletePost = (BoardModel, thread_id, post_id, password, res) => {
  post_id = post_id.replace(/\s/g, "");
  thread_id = thread_id.replace(/\s/g, "");

  BoardModel.findById(thread_id, (err, t) => {
    if (err || !t) return res.type("text").send("not found");

    const r = t.replies.id(post_id);
    if (!r) return res.type("text").send("incorrect post id");
    if (r.delete_password !== password) {
      return res.type("text").send("incorrect password");
    }

    r.text = "[deleted]";
    // replycount: puedes mantener o decrementar; FCC no lo exige en esta ruta
    // t.replycount = Math.max(0, (t.replycount || (t.replies || []).length) - 1);

    t.save((err2) => {
      if (err2) return res.type("text").send("server error");
      return res.type("text").send("success");
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
