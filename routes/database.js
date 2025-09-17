// database.js — versión compatible con los tests de FCC

// Crear hilo
const createThread = (document, res, boardName) => {
  document.save((err, data) => {
    if (err) return res.type("text").send("server error");
    // FCC no exige redirect; JSON ayuda a los tests
    return res.json({ _id: data._id, board: boardName });
    // Si prefieres el redirect del front, usa:
    // return res.redirect(`/b/${boardName}?_id=${data._id}`);
  });
};

// Listar 10 hilos más recientes con 3 replies c/u (sanitizado)
const showAll = (Board, res) => {
  Board.find({}, { replies: { $slice: -3 } }) // últimas 3 (las más recientes)
    .sort({ bumped_on: -1 })
    .limit(10)
    // Ocultar en hilo y en replies
    .select(
      "-delete_password -reported -replies.delete_password -replies.reported"
    )
    .lean()
    .exec((err, data) => {
      if (err) return res.type("text").send(err.message);

      // (Opcional) ordenar esas 3 replies por fecha asc para consistencia visual
      data.forEach((t) => {
        if (Array.isArray(t.replies)) {
          t.replies.sort(
            (a, b) => new Date(a.created_on) - new Date(b.created_on)
          );
        }
      });

      res.json(data);
    });
};

// Reportar hilo
const reportThread = (Board, _id, res) => {
  const id = (_id || "").replace(/\s/g, "");
  Board.findByIdAndUpdate(
    id,
    { $set: { reported: true } },
    { new: true },
    (err, doc) => {
      if (err || !doc) return res.type("text").send("not found");
      return res.type("text").send("reported");
    }
  );
};

// Borrar hilo
const deleteThread = (Board, _id, password, res) => {
  const id = (_id || "").replace(/\s/g, "");
  Board.findById(id, (err, doc) => {
    if (err || !doc) return res.type("text").send("not found");
    if (doc.delete_password !== password) {
      return res.type("text").send("incorrect password");
    }
    Board.deleteOne({ _id: id }, (err2) => {
      if (err2) return res.type("text").send("server error");
      return res.type("text").send("success");
    });
  });
};

// Crear respuesta (update bumped_on, replycount) → success
const createPost = (Board, body, res /*, boardName */) => {
  Board.findOneAndUpdate(
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
      // Si quisieras el redirect de tu front:
      // return res.redirect('/b/' + boardName + '/' + body.thread_id + '?reply_id=' + doc.replies[doc.replies.length - 1]._id);
    }
  );
};

// Ver un hilo completo con TODAS sus replies (sanitizado)
const showThread = (Board, _id, res) => {
  const id = (_id || "").replace(/\s/g, "");
  Board.findById(id)
    .select(
      "-delete_password -reported -replies.delete_password -replies.reported"
    )
    .lean()
    .exec((err, doc) => {
      if (err) return res.type("text").send(err.message);
      if (!doc) return res.type("text").send("not found");

      // (Opcional) ordenar replies por fecha
      if (Array.isArray(doc.replies)) {
        doc.replies.sort(
          (a, b) => new Date(a.created_on) - new Date(b.created_on)
        );
      }

      res.json(doc);
    });
};

// Reportar respuesta
const reportPost = (Board, thread_id, post_id, res) => {
  const tid = (thread_id || "").replace(/\s/g, "");
  const pid = (post_id || "").replace(/\s/g, "");

  Board.updateOne(
    { _id: tid, "replies._id": pid },
    { $set: { "replies.$.reported": true } }
  ).exec((err, result) => {
    if (err) return res.type("text").send("not found");
    const matched = result?.matchedCount ?? result?.n; // compat Mongoose
    if (matched === 1) return res.type("text").send("reported");
    return res.type("text").send("not found");
  });
};

// Borrar respuesta (texto = "[deleted]")
const deletePost = (Board, thread_id, post_id, password, res) => {
  const tid = (thread_id || "").replace(/\s/g, "");
  const pid = (post_id || "").replace(/\s/g, "");

  Board.findById(tid, (err, t) => {
    if (err || !t) return res.type("text").send("incorrect board or thread id");

    const r = t.replies.id(pid);
    if (!r) return res.type("text").send("incorrect post id");
    if (r.delete_password !== password) {
      return res.type("text").send("incorrect password");
    }

    r.text = "[deleted]";
    t.replycount = Math.max(0, (t.replycount || 0) - 1);

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
