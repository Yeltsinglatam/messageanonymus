"use strict";

const mongoose = require("mongoose");

mongoose.set("strictQuery", false);
mongoose.connect(process.env.DB);

module.exports = function (app) {
  app
    .route("/api/threads/:board")
    .get(threadController.getRelatedThreads)
    .post(threadValidator, threadController.createThread)
    .put(threadController.reportThread)
    .delete(threadController.deleteThread);

  app
    .route("/api/replies/:board")
    .get(threadController.getSingleThread)
    .post(threadReplyValidator, threadController.createThreadReply)
    .put(threadController.reportThreadReply)
    .delete(threadController.deleteThreadReply);
};
