// tests/2_functional-tests.js
const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../server");

const { expect } = chai;
chai.use(chaiHttp);

suite("Functional Tests", function () {
  this.timeout(8000);

  const board = "fccboard-" + Date.now();
  let threadId; // se setea al crear hilo
  let replyId; // se setea al crear reply

  /* 1) Crear un hilo */
  test("Creating a new thread: POST /api/threads/{board}", async () => {
    const res = await chai
      .request(server)
      .post(`/api/threads/${board}`)
      .type("form")
      .send({ text: "Thread A", delete_password: "tpass" });

    expect(res).to.have.status(200);
    // el POST redirige a /b/:board/?_id=<threadId>
    expect(res.redirects[0]).to.match(new RegExp(`/b/${board}/\\?_id=`, "i"));
  });

  /* 2) Ver 10 hilos (3 replies c/u) */
  test("Viewing the 10 most recent threads with 3 replies each: GET /api/threads/{board}", async () => {
    const res = await chai.request(server).get(`/api/threads/${board}`);
    expect(res).to.have.status(200);
    expect(res.body).to.be.an("array");
    expect(res.body.length).to.be.at.least(1);
    const t = res.body.find((x) => x.text === "Thread A") || res.body[0];
    expect(t).to.have.property("_id");
    expect(t).to.have.property("text");
    expect(t).to.have.property("created_on");
    expect(t).to.have.property("bumped_on");
    expect(t).to.have.property("replies").that.is.an("array");
    expect(t).to.have.property("replycount");
    expect(t).to.not.have.property("reported");
    expect(t).to.not.have.property("delete_password");
    threadId = t._id;
  });

  /* 3) Borrar hilo con password incorrecto */
  test("Deleting a thread with the incorrect password: DELETE /api/threads/{board}", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/threads/${board}`)
      .type("form")
      .send({ thread_id: threadId, delete_password: "wrong" });

    expect(res).to.have.status(200);
    expect(res.text).to.equal("incorrect password");
  });

  /* 4) Reportar hilo */
  test("Reporting a thread: PUT /api/threads/{board}", async () => {
    const res = await chai
      .request(server)
      .put(`/api/threads/${board}`)
      .type("form")
      .send({ thread_id: threadId });

    expect(res).to.have.status(200);
    expect(res.text).to.equal("reported");
  });

  /* 5) Crear reply */
  test("Creating a new reply: POST /api/replies/{board}", async () => {
    const res = await chai
      .request(server)
      .post(`/api/replies/${board}`)
      .type("form")
      .send({
        thread_id: threadId,
        text: "First reply",
        delete_password: "rpass",
      });

    expect(res).to.have.status(200);
    // redirige a /b/:board/:threadId?_id=<replyId>
    expect(res.redirects[0]).to.match(
      new RegExp(`/b/${board}/${threadId}\\?_id=`, "i")
    );
  });

  /* 6) Ver un hilo con TODAS sus replies */
  test("Viewing a single thread with all replies: GET /api/replies/{board}", async () => {
    const res = await chai
      .request(server)
      .get(`/api/replies/${board}`)
      .query({ thread_id: threadId });

    expect(res).to.have.status(200);
    expect(res.body).to.be.an("object");
    expect(res.body).to.have.property("_id", threadId);
    expect(res.body).to.have.property("replies").that.is.an("array");
    expect(res.body).to.not.have.property("reported");
    expect(res.body).to.not.have.property("delete_password");
    expect(res.body.replies[0]).to.be.an("object");
    expect(res.body.replies[0]).to.not.have.property("reported");
    expect(res.body.replies[0]).to.not.have.property("delete_password");

    replyId = res.body.replies[0]._id;
  });

  /* 7) Borrar reply con password incorrecto */
  test("Deleting a reply with the incorrect password: DELETE /api/replies/{board}", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/replies/${board}`)
      .type("form")
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: "nope",
      });

    expect(res).to.have.status(200);
    expect(res.text).to.equal("incorrect password");
  });

  /* 8) Reportar reply */
  test("Reporting a reply: PUT /api/replies/{board}", async () => {
    const res = await chai
      .request(server)
      .put(`/api/replies/${board}`)
      .type("form")
      .send({ thread_id: threadId, reply_id: replyId });

    expect(res).to.have.status(200);
    expect(res.text).to.equal("reported");
  });

  /* 9) Borrar reply con password correcto */
  test("Deleting a reply with the correct password: DELETE /api/replies/{board}", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/replies/${board}`)
      .type("form")
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: "rpass",
      });

    expect(res).to.have.status(200);
    expect(res.text).to.equal("success");
  });

  /* 10) Borrar hilo con password correcto */
  test("Deleting a thread with the correct password: DELETE /api/threads/{board}", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/threads/${board}`)
      .type("form")
      .send({ thread_id: threadId, delete_password: "tpass" });

    expect(res).to.have.status(200);
    expect(res.text).to.equal("success");
  });
});
