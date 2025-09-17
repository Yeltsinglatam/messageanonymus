// routes/api.js
"use strict";

const mongoose = require("mongoose");

/* ===== Esquemas ===== */
const replySchema = new mongoose.Schema({
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false }
});

const threadSchema = new mongoose.Schema({
  board: { type: String, index: true },
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now, index: true },
  reported: { type: Boolean, default: false },
  delete_password: { type: String, required: true },
  replies: [replySchema],
  replycount: { type: Number, default: 0 }
});

/* Un solo modelo con campo `board` */
const Thread = mongoose.models.Thread || mongoose.model("Thread", threadSchema);

/* ===== Helpers (sin campos sensibles) ===== */
function listView(t) {
  const replies = (t.replies || [])
    .sort((a, b) => new Date(b.created_on) - new Date(a.created_on))
    .slice(0, 3)
    .map(r => ({ _id: r._id, text: r.text, created_on: r.created_on }));

  return {
    _id: t._id,
    text: t.text,
    created_on: t.created_on,
    bumped_on: t.bumped_on,
    replies,
    replycount: t.replycount || (t.replies ? t.replies.length : 0)
  };
}

function fullView(t) {
  return {
    _id: t._id,
    text: t.text,
    created_on: t.created_on,
    bumped_on: t.bumped_on,
    replycount: t.replycount || (t.replies ? t.replies.length : 0),
    replies: (t.replies || []).map(r => ({
      _id: r._id,
      text: r.text,
      created_on: r.created_on
    }))
  };
}

/* ===== Rutas ===== */
module.exports = function (app) {
  /* ---------- THREADS ---------- */
  app.route("/api/threads/:board")

    // Ver 10 hilos más recientes (máx 3 replies c/u)
    .get(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const docs = await Thread.find({ board })
          .sort({ bumped_on: -1 })
          .limit(10)
          .lean();
        return res.json(docs.map(listView));
      } catch {
        return res.type("text").send("server error");
      }
    })

    // Crear hilo → redirect /b/:board/?_id=<threadId>
    .post(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { text, delete_password } = req.body || {};
        if (!text || !delete_password) return res.type("text").send("incorrect query");

        const doc = await Thread.create({ board, text, delete_password });
        return res.redirect(`/b/${board}/?_id=${doc._id}`);
      } catch {
        return res.type("text").send("server error");
      }
    })

    // Reportar hilo → "reported" | "incorrect board or id"
    .put(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        let { thread_id } = req.body || {};
        if (!thread_id) return res.type("text").send("incorrect query");
        thread_id = String(thread_id).trim();

        const isValidId = /^[0-9a-fA-F]{24}$/.test(thread_id);
        if (!isValidId) return res.type("text").send("incorrect board or id");

        const upd = await Thread.findOneAndUpdate(
          { _id: thread_id, board },
          { $set: { reported: true } },
          { new: true }
        );
        if (!upd) return res.type("text").send("incorrect board or id");
        return res.type("text").send("reported");
      } catch {
        return res.type("text").send("incorrect board or id");
      }
    })

    // Borrar hilo → "success" | "incorrect password" | "incorrect board or id"
    .delete(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, delete_password } = req.body || {};
        if (!thread_id || !delete_password) return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board });
        if (!t) return res.type("text").send("incorrect board or id");
        if (t.delete_password !== delete_password) {
          return res.type("text").send("incorrect password");
        }
        await Thread.deleteOne({ _id: thread_id, board });
        return res.type("text").send("success");
      } catch {
        return res.type("text").send("server error");
      }
    });

  /* ---------- REPLIES ---------- */
  app.route("/api/replies/:board")

    // Ver un hilo con TODAS sus replies
    .get(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id } = req.query || {};
        if (!thread_id) return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board }).lean();
        if (!t) return res.type("text").send("incorrect board or id");

        t.replies = (t.replies || []).sort((a, b) => new Date(b.created_on) - new Date(a.created_on));
        return res.json(fullView(t));
      } catch {
        return res.type("text").send("server error");
      }
    })

    // Crear reply → redirect /b/:board/:thread_id?_id=<replyId>
    .post(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, text, delete_password } = req.body || {};
        if (!thread_id || !text || !delete_password) return res.type("text").send("incorrect query");

        const now = new Date();
        const upd = await Thread.findOneAndUpdate(
          { _id: thread_id, board },
          {
            $push: { replies: { text, delete_password, created_on: now } },
            $set: { bumped_on: now },
            $inc: { replycount: 1 }
          },
          { new: true }
        );
        if (!upd) return res.type("text").send("incorrect board or id");

        const newReplyId = upd.replies[upd.replies.length - 1]._id;
        return res.redirect(`/b/${board}/${thread_id}?_id=${newReplyId}`);
      } catch {
        return res.type("text").send("server error");
      }
    })

    // Reportar reply → "reported" | "incorrect board or id"
    .put(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, reply_id } = req.body || {};
        if (!thread_id || !reply_id) return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board });
        if (!t) return res.type("text").send("incorrect board or id");
        const r = t.replies.id(reply_id);
        if (!r) return res.type("text").send("incorrect board or id");

        r.reported = true;
        await t.save();
        return res.type("text").send("reported");
      } catch {
        return res.type("text").send("server error");
      }
    })

    // Borrar reply → "[deleted]" y "success" / "incorrect password"
    .delete(async (req, res) => {
      try {
        const board = String(req.params.board || "").toLowerCase();
        const { thread_id, reply_id, delete_password } = req.body || {};
        if (!thread_id || !reply_id || !delete_password) return res.type("text").send("incorrect query");

        const t = await Thread.findOne({ _id: thread_id, board });
        if (!t) return res.type("text").send("incorrect board or thread id");
        const r = t.replies.id(reply_id);
        if (!r) return res.type("text").send("incorrect post id");
        if (r.delete_password !== delete_password) {
          return res.type("text").send("incorrect password");
        }

        r.text = "[deleted]";
        t.replycount = Math.max(0, (t.replycount || 0) - 1);
        await t.save();
        return res.type("text").send("success");
      } catch {
        return res.type("text").send("server error");
      }
    });
};
