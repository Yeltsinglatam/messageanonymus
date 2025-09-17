"use strict";

const mongoose = require("mongoose");

// Si usas modelos por board, evita OverwriteModelError:
function getThreadModel(boardName, threadSchema) {
  const name = boardName.toLowerCase();
  return mongoose.models[name] || mongoose.model(name, threadSchema, name);
}

let Schema = mongoose.Schema;

const repliesSchema = new Schema({
  text: String,
  created_on: { type: Date, default: new Date() },
  delete_password: String,
  reported: { type: Boolean, default: false },
});

const threadSchema = new Schema({
  text: String,
  created_on: { type: Date, default: new Date() },
  bumped_on: { type: Date, default: new Date() },
  reported: { type: Boolean, default: false },
  delete_password: String,
  replies: [repliesSchema],
  replycount: { type: Number, default: 0 },
});

const database = require("./database.js");

module.exports = function (app) {
  app
    .route("/api/threads/:board")
    .get((req, res) => {
      const Thread = getThreadModel(req.params.board, threadSchema);
      database.showAll(Thread, res);
    })
    .post((req, res) => {
      if (!("text" in req.body) || !("delete_password" in req.body)) {
        return res.type("text").send("incorrect query");
      }
      const Thread = getThreadModel(req.params.board, threadSchema);
      const document = new Thread({
        text: req.body.text,
        reported: false,
        created_on: new Date(),
        bumped_on: new Date(),
        delete_password: req.body.delete_password,
      });
      database.createThread(document, res, req.params.board.toLowerCase());
    })
    .put((req, res) => {
      if (!("thread_id" in req.body))
        return res.type("text").send("incorrect query");
      const Thread = getThreadModel(req.params.board, threadSchema);
      database.reportThread(Thread, req.body.thread_id, res);
    })
    .delete((req, res) => {
      if (!("thread_id" in req.body) || !("delete_password" in req.body)) {
        return res.type("text").send("incorrect query");
      }
      const Thread = getThreadModel(req.params.board, threadSchema);
      database.deleteThread(
        Thread,
        req.body.thread_id,
        req.body.delete_password,
        res
      );
    });

  app
    .route("/api/replies/:board")
    .get((req, res) => {
      if (!("thread_id" in req.query))
        return res.type("text").send("incorrect query");
      const Thread = getThreadModel(req.params.board, threadSchema);
      database.showThread(Thread, req.query.thread_id, res);
    })
    .post((req, res) => {
      if (
        !("thread_id" in req.body) ||
        !("text" in req.body) ||
        !("delete_password" in req.body)
      ) {
        return res.type("text").send("incorrect query");
      }
      const Thread = getThreadModel(req.params.board, threadSchema);
      database.createPost(
        Thread,
        req.body,
        res,
        req.params.board.toLowerCase()
      );
    })
    .put((req, res) => {
      if (!("thread_id" in req.body) || !("reply_id" in req.body)) {
        return res.type("text").send("incorrect query");
      }
      const Thread = getThreadModel(req.params.board, threadSchema);
      database.reportPost(Thread, req.body.thread_id, req.body.reply_id, res);
    })
    .delete((req, res) => {
      if (
        !("thread_id" in req.body) ||
        !("reply_id" in req.body) ||
        !("delete_password" in req.body)
      ) {
        return res.type("text").send("incorrect query");
      }
      const Thread = getThreadModel(req.params.board, threadSchema);
      database.deletePost(
        Thread,
        req.body.thread_id,
        req.body.reply_id,
        req.body.delete_password,
        res
      );
    });
};
