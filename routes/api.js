"use strict";
const mongoose = require("mongoose");

/* ====== Esquemas ====== */
const replySchema = new mongoose.Schema({
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false },
});

const threadSchema = new mongoose.Schema({
  board: { type: String, index: true },
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now, index: true },
  reported: { type: Boolean, default: false },
  delete_password: { type: String, required: true },
  replies: [replySchema],
  replycount: { type: Number, default: 0 },
});

const Thread = mongoose.models.Thread || mongoose.model("Thread", threadSchema);

/* ====== Helpers ====== */
function sanitizeThreadForList(t) {
  // Devuelve thread con máx. 3 replies (las más recientes) y sin campos sensibles
  const replies = (t.replies || [])
    .sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
    .slice(0, 3)
    .map((r) => ({ _id: r._id, text: r.text, created_on: r.created_on }));
  return {
    _id: t._id,
    text: t.text,
    created_on: t.created_on,
    bumped_on: t.bumped_on,
    replies,
    replycount: t.replycount || (t.replies ? t.replies.length : 0),
  };
}

function sanitizeThreadFull(t) {
  // Devuelve thread completo con TODAS las replies, sin campos sensibles
  return {
    _id: t._id,
    text: t.text,
    created_on: t.created_on,
    bumped_on: t.bumped_on,
    replies: (t.replies || []).map((r) => ({
      _id: r._id,
      text: r.text,
      created_on: r.created_on,
    })),
  };
}

/* ====== Rutas ====== */
module.exports = function (app) {
  /* ---------- THREADS ---------- */
  app
    .route("/api/threads/:board")
    // Crear thread
    .post(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { text, delete_password } = req.body || {};
        if (!text || !delete_password)
          return res.type("text").send("incorrect query");

        const doc = await Thread.create({ board, text, delete_password });
        // FCC acepta redirect o json; devolvemos JSON con _id para facilitar las pruebas
        return res.json({ _id: doc._id, board: doc.board });
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    })

    // Listar 10 threads más recientes (3 replies c/u)
    .get(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const docs = await Thread.find({ board })
          .sort({ bumped_on: -1 })
          .limit(10)
          .lean();

        const list = docs.map(sanitizeThreadForList);
        return res.json(list);
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    })

    // Reportar thread
    .put(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id } = req.body || {};
        if (!thread_id) return res.type("text").send("incorrect query");

        const updated = await Thread.findOneAndUpdate(
          { _id: thread_id, board },
          { $set: { reported: true } },
          { new: true }
        );
        if (!updated) return res.type("text").send("not found");
        return res.type("text").send("reported");
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    })

    // Borrar thread
    .delete(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, delete_password } = req.body || {};
        if (!thread_id || !delete_password)
          return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board });
        if (!t || t.delete_password !== delete_password) {
          return res.type("text").send("incorrect password");
        }
        await Thread.deleteOne({ _id: thread_id, board });
        return res.type("text").send("success");
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    });

  /* ---------- REPLIES ---------- */
  app
    .route("/api/replies/:board")
    // Crear reply
    .post(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, text, delete_password } = req.body || {};
        if (!thread_id || !text || !delete_password)
          return res.type("text").send("incorrect query");

        const updated = await Thread.findOneAndUpdate(
          { _id: thread_id, board },
          {
            $push: { replies: { text, delete_password } },
            $set: { bumped_on: new Date() },
            $inc: { replycount: 1 },
          },
          { new: true }
        );
        if (!updated) return res.type("text").send("not found");
        // FCC acepta redirect o éxito simple
        return res.type("text").send("success");
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    })

    // Obtener un thread con TODAS sus replies
    .get(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id } = req.query || {};
        if (!thread_id) return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board }).lean();
        if (!t) return res.type("text").send("not found");
        return res.json(sanitizeThreadFull(t));
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    })

    // Reportar reply
    .put(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, reply_id } = req.body || {};
        if (!thread_id || !reply_id)
          return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board });
        if (!t) return res.type("text").send("not found");
        const r = t.replies.id(reply_id);
        if (!r) return res.type("text").send("not found");

        r.reported = true;
        await t.save();
        return res.type("text").send("reported");
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    })

    // Borrar reply (poner "[deleted]")
    .delete(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, reply_id, delete_password } = req.body || {};
        if (!thread_id || !reply_id || !delete_password)
          return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board });
        if (!t) return res.type("text").send("not found");
        const r = t.replies.id(reply_id);
        if (!r) return res.type("text").send("not found");

        if (r.delete_password !== delete_password) {
          return res.type("text").send("incorrect password");
        }
        r.text = "[deleted]";
        await t.save();
        return res.type("text").send("success");
      } catch (e) {
        return res.status(500).type("text").send("server error");
      }
    });
};
