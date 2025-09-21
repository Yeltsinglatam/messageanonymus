"use strict";

const mongoose = require("mongoose");

// ───────────────── Schemas/Model
const ReplySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    delete_password: { type: String, required: true },
    reported: { type: Boolean, default: false },
    created_on: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ThreadSchema = new mongoose.Schema({
  board: { type: String, required: true, index: true },
  text: { type: String, required: true },
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  replies: { type: [ReplySchema], default: [] },
});

const Thread = mongoose.models.Thread || mongoose.model("Thread", ThreadSchema);

// Helper
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

module.exports = function (app) {
  // ───────────── Threads
  // Crear hilo -> redirige a /b/:board/
  app.post("/api/threads/:board", async (req, res) => {
    try {
      const board = req.params.board;
      const { text, delete_password } = req.body;
      if (!text || !delete_password)
        return res.status(400).type("text").send("missing fields");

      await Thread.create({
        board,
        text,
        delete_password,
        created_on: new Date(),
        bumped_on: new Date(),
      });

      return res.redirect(302, `/b/${board}/`);
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // Ver 10 hilos con máx 3 replies (sin campos sensibles)
  app.get("/api/threads/:board", async (req, res) => {
    try {
      const board = req.params.board;

      const threads = await Thread.find({ board })
        .sort({ bumped_on: -1 })
        .limit(10)
        .select(
          "text created_on bumped_on replies._id replies.text replies.created_on"
        )
        .lean();

      const sanitized = threads.map((t) => {
        const replies = (t.replies || [])
          .slice()
          .sort((a, b) => b.created_on - a.created_on) // últimas 3 más recientes
          .slice(0, 3)
          .map((r) => ({ _id: r._id, text: r.text, created_on: r.created_on }));

        return {
          _id: t._id,
          text: t.text,
          created_on: t.created_on,
          bumped_on: t.bumped_on,
          replycount: t.replies ? t.replies.length : 0,
          replies,
        };
      });

      return res.json(sanitized);
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // Reportar hilo
  app.put("/api/threads/:board", async (req, res) => {
    try {
      const { thread_id } = req.body;
      if (!thread_id || !isObjectId(thread_id))
        return res.status(400).type("text").send("missing fields");

      const t = await Thread.findById(thread_id);
      if (!t) return res.status(404).type("text").send("not found");

      t.reported = true;
      await t.save();

      return res.type("text").send("reported");
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // Borrar hilo
  app.delete("/api/threads/:board", async (req, res) => {
    try {
      const { thread_id, delete_password } = req.body;
      if (!thread_id || !delete_password || !isObjectId(thread_id)) {
        return res.status(400).type("text").send("missing fields");
      }

      const t = await Thread.findById(thread_id);
      if (!t) return res.type("text").send("incorrect password");
      if (t.delete_password !== delete_password)
        return res.type("text").send("incorrect password");

      await Thread.deleteOne({ _id: t._id });
      return res.type("text").send("success");
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // ───────────── Replies
  // Crear reply -> redirige a /b/:board/:thread_id (y usa la MISMA fecha para created_on y bumped_on)
  app.post("/api/replies/:board", async (req, res) => {
    try {
      const board = req.params.board;
      const { thread_id, text, delete_password } = req.body;
      if (!thread_id || !text || !delete_password || !isObjectId(thread_id)) {
        return res.status(400).type("text").send("missing fields");
      }

      const t = await Thread.findById(thread_id);
      if (!t) return res.status(404).type("text").send("not found");

      // ✅ FECHA ÚNICA para evitar descalce en el test 6
      const now = new Date();

      t.replies.push({
        text,
        delete_password, // debe existir en DB para el test 6
        reported: false, // idem
        created_on: now,
      });

      t.bumped_on = now; // ✅ EXACTAMENTE la misma fecha del comentario
      await t.save();

      // FCC: redirección esperada (sin query extra)
      return res.redirect(302, `/b/${board}/${t._id}`);
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // Ver un hilo con TODAS sus replies (sin exponer delete_password/reportado)
  app.get("/api/replies/:board", async (req, res) => {
    try {
      const { thread_id } = req.query;
      if (!thread_id || !isObjectId(thread_id)) {
        return res.status(400).type("text").send("missing fields");
      }

      // Solo campos públicos del hilo y replies
      const t = await Thread.findById(thread_id)
        .select(
          "text created_on bumped_on replies._id replies.text replies.created_on"
        )
        .lean();

      if (!t) return res.status(404).type("text").send("not found");

      // Mantener orden original
      const replies = (t.replies || []).map((r) => ({
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
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // Reportar reply
  app.put("/api/replies/:board", async (req, res) => {
    try {
      const { thread_id, reply_id } = req.body;
      if (
        !thread_id ||
        !reply_id ||
        !isObjectId(thread_id) ||
        !isObjectId(reply_id)
      ) {
        return res.status(400).type("text").send("missing fields");
      }

      const t = await Thread.findById(thread_id);
      if (!t) return res.status(404).type("text").send("not found");
      const r = t.replies.id(reply_id);
      if (!r) return res.status(404).type("text").send("not found");

      r.reported = true;
      await t.save();

      return res.type("text").send("reported");
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // Borrar reply (text = "[deleted]" si pass correcta)
  app.delete("/api/replies/:board", async (req, res) => {
    try {
      const { thread_id, reply_id, delete_password } = req.body;
      if (
        !thread_id ||
        !reply_id ||
        !delete_password ||
        !isObjectId(thread_id) ||
        !isObjectId(reply_id)
      ) {
        return res.status(400).type("text").send("missing fields");
      }

      const t = await Thread.findById(thread_id);
      if (!t) return res.status(404).type("text").send("not found");
      const r = t.replies.id(reply_id);
      if (!r) return res.status(404).type("text").send("not found");

      if (r.delete_password !== delete_password)
        return res.type("text").send("incorrect password");
      r.text = "[deleted]";
      await t.save();

      return res.type("text").send("success");
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });
};
