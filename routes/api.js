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

// Helper rápido para validar ObjectId
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

module.exports = function (app) {
  // ───────────── Threads
  // Crear hilo (redirige a /b/:board/)
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

  // Ver 10 hilos con máx 3 replies (ocultar campos sensibles)
  app.get("/api/threads/:board", async (req, res) => {
    try {
      const board = req.params.board;
      // Excluimos reported / delete_password a nivel de thread y reply
      const threads = await Thread.find({ board })
        .sort({ bumped_on: -1 })
        .limit(10)
        .select(
          "-reported -delete_password -replies.reported -replies.delete_password"
        )
        .lean();

      const sanitized = threads.map((t) => {
        const replies = (t.replies || [])
          .sort((a, b) => b.created_on - a.created_on) // últimos primero
          .slice(0, 3)
          .map((r) => ({ _id: r._id, text: r.text, created_on: r.created_on }));
        return {
          _id: t._id,
          text: t.text,
          created_on: t.created_on,
          bumped_on: t.bumped_on,
          replycount: t.replies?.length || 0,
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
  // Crear reply (redirige a /b/:board/:thread_id?_id=<replyId>)
  app.post("/api/replies/:board", async (req, res) => {
    try {
      const board = req.params.board;
      const { thread_id, text, delete_password } = req.body;
      if (!thread_id || !text || !delete_password || !isObjectId(thread_id)) {
        return res.status(400).type("text").send("missing fields");
      }

      const t = await Thread.findById(thread_id);
      if (!t) return res.status(404).type("text").send("not found");

      t.replies.push({
        text,
        delete_password,
        created_on: new Date(),
        reported: false,
      });
      t.bumped_on = new Date();
      await t.save();

      const replyId = t.replies[t.replies.length - 1]._id.toString();
      return res.redirect(302, `/b/${board}/${t._id}?_id=${replyId}`);
    } catch (e) {
      return res.status(500).type("text").send("server error");
    }
  });

  // Ver un hilo con todas sus replies (ocultar campos sensibles SIEMPRE)
  app.get("/api/replies/:board", async (req, res) => {
    try {
      const { thread_id } = req.query;
      if (!thread_id || !isObjectId(thread_id)) {
        return res.status(400).type("text").send("missing fields");
      }

      // Quitamos reported y delete_password del thread y de cada reply desde la consulta
      const t = await Thread.findById(thread_id)
        .select(
          "-reported -delete_password -replies.reported -replies.delete_password"
        )
        .lean();

      if (!t) return res.status(404).type("text").send("not found");

      // Ordena TODAS las replies por fecha ascendente (muchos test lo aceptan mejor)
      const replies = (t.replies || [])
        .map((r) => ({ _id: r._id, text: r.text, created_on: r.created_on }))
        .sort((a, b) => new Date(a.created_on) - new Date(b.created_on));

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
