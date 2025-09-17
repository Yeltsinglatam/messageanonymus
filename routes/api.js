// routes/api.js
"use strict";

const mongoose = require("mongoose");
const database = require("./database.js");


// ==== Esquemas (una colección por board) ====
const replySchema = new mongoose.Schema({
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false },
});

const threadSchema = new mongoose.Schema({
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  reported: { type: Boolean, default: false },
  delete_password: { type: String, required: true },
  replies: [replySchema],
  replycount: { type: Number, default: 0 },
});

// Evita OverwriteModelError al reutilizar el mismo modelo
function BoardModel(boardName) {
  const name = String(boardName || "").toLowerCase();
  return mongoose.models[name] || mongoose.model(name, threadSchema, name);
}

// ⚠️ IMPORTANTE: NO conectar aquí. La conexión a Mongo va en server.js

module.exports = function (app) {
  // ---------- THREADS ----------
  app
    .route("/api/threads/:board")
    // Ver 10 hilos más recientes (3 replies c/u)
    .get((req, res) => {
      const Board = BoardModel(req.params.board);
      database.showAll(Board, res);
    })
    // Crear hilo (redirect con ?_id=)
    .post((req, res) => {
      const board = String(req.params.board || "").toLowerCase();
      const { text, delete_password } = req.body || {};
      if (!text || !delete_password)
        return res.type("text").send("incorrect query");

      const Board = BoardModel(board);
      const doc = new Board({
        text,
        delete_password,
        created_on: new Date(),
        bumped_on: new Date(),
        reported: false,
        replies: [],
        replycount: 0,
      });

      database.createThread(doc, res, board);
    })
    // Reportar hilo
    .put((req, res) => {
      const { thread_id } = req.body || {};
      if (!thread_id) return res.type("text").send("incorrect query");
      const Board = BoardModel(req.params.board);
      database.reportThread(Board, thread_id, res);
    })
    // Borrar hilo
    .delete((req, res) => {
      const { thread_id, delete_password } = req.body || {};
      if (!thread_id || !delete_password)
        return res.type("text").send("incorrect query");
      const Board = BoardModel(req.params.board);
      database.deleteThread(Board, thread_id, delete_password, res);
    });

  // ---------- REPLIES ----------
  app
    .route("/api/replies/:board")
    // Ver un hilo con TODAS sus replies
    .get((req, res) => {
      const { thread_id } = req.query || {};
      if (!thread_id) return res.type("text").send("incorrect query");
      const Board = BoardModel(req.params.board);
      database.showThread(Board, thread_id, res);
    })
    // Crear reply (bump y redirect con ?_id=<replyId>)
    .post((req, res) => {
      const board = String(req.params.board || "").toLowerCase();
      const { thread_id, text, delete_password } = req.body || {};
      if (!thread_id || !text || !delete_password)
        return res.type("text").send("incorrect query");
      const Board = BoardModel(board);
      database.createPost(
        Board,
        { thread_id, text, delete_password },
        res,
        board
      );
    })
    // Reportar reply
    .put((req, res) => {
      const { thread_id, reply_id } = req.body || {};
      if (!thread_id || !reply_id)
        return res.type("text").send("incorrect query");
      const Board = BoardModel(req.params.board);
      database.reportPost(Board, thread_id, reply_id, res);
    })
    // Borrar reply (texto = "[deleted]")
    .delete((req, res) => {
      const { thread_id, reply_id, delete_password } = req.body || {};
      if (!thread_id || !reply_id || !delete_password)
        return res.type("text").send("incorrect query");
      const Board = BoardModel(req.params.board);
      database.deletePost(Board, thread_id, reply_id, delete_password, res);
    });
};
