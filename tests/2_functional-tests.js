const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../server");

const { assert } = chai;
chai.use(chaiHttp);

suite("Functional Tests", function () {
  this.timeout(8000);

  const board = "fccboard-" + Date.now();
  let threadId;
  const threadPass = "pass123";

  let replyId;
  const replyPass = "reply123";

  // 1) Crear thread
  test("POST /api/threads/:board crea hilo y redirige", async () => {
    const res = await chai
      .request(server)
      .post(`/api/threads/${board}`)
      .type("form")
      .send({ text: "Primer hilo", delete_password: threadPass });

    assert.equal(res.status, 200); // superagent sigue la 302 y devuelve 200 de la vista
    assert.match(res.redirects.join(" "), new RegExp(`/b/${board}/`));
  });

  // 2) Ver 10 threads con hasta 3 replies
  test("GET /api/threads/:board lista threads", async () => {
    const res = await chai.request(server).get(`/api/threads/${board}`);
    assert.equal(res.status, 200);
    assert.isArray(res.body);
    assert.isAtMost(res.body.length, 10);
    if (res.body.length > 0) {
      const t = res.body[0];
      threadId = t._id;
      assert.notProperty(t, "reported");
      assert.notProperty(t, "delete_password");
      assert.isAtMost(t.replies.length, 3);
    }
  });

  // 3) Reportar thread
  test("PUT /api/threads/:board reporta", async () => {
    const res = await chai
      .request(server)
      .put(`/api/threads/${board}`)
      .type("form")
      .send({ thread_id: threadId });
    assert.equal(res.status, 200);
    assert.equal(res.text, "reported");
  });

  // 4) Borrar thread con pass incorrecta
  test("DELETE /api/threads/:board pass incorrecta", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/threads/${board}`)
      .type("form")
      .send({ thread_id: threadId, delete_password: "wrong" });
    assert.equal(res.status, 200);
    assert.equal(res.text, "incorrect password");
  });

  // 5) Crear reply
  test("POST /api/replies/:board crea reply y redirige", async () => {
    const res = await chai
      .request(server)
      .post(`/api/replies/${board}`)
      .type("form")
      .send({
        thread_id: threadId,
        text: "Mi primera respuesta",
        delete_password: replyPass,
      });
    assert.equal(res.status, 200); // tras seguir la redirección
    assert.match(
      res.redirects.join(" "),
      new RegExp(`/b/${board}/${threadId}`)
    );
  });

  // 6) Ver thread con todas las replies
  test("GET /api/replies/:board muestra hilo completo", async () => {
    const res = await chai
      .request(server)
      .get(`/api/replies/${board}`)
      .query({ thread_id: threadId });
    assert.equal(res.status, 200);
    assert.equal(res.body._id, threadId);
    assert.isArray(res.body.replies);
    assert.isAtLeast(res.body.replies.length, 1);
    replyId = res.body.replies[0]._id;
    const r = res.body.replies[0];
    assert.notProperty(r, "delete_password");
    assert.notProperty(r, "reported");
  });

  // 7) Borrar reply con pass incorrecta
  test("DELETE /api/replies/:board pass incorrecta", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/replies/${board}`)
      .type("form")
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: "nope",
      });
    assert.equal(res.status, 200);
    assert.equal(res.text, "incorrect password");
  });

  // 8) Reportar reply
  test("PUT /api/replies/:board reporta", async () => {
    const res = await chai
      .request(server)
      .put(`/api/replies/${board}`)
      .type("form")
      .send({ thread_id: threadId, reply_id: replyId });
    assert.equal(res.status, 200);
    assert.equal(res.text, "reported");
  });

  // 9) Borrar reply con pass correcta
  test("DELETE /api/replies/:board pass correcta", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/replies/${board}`)
      .type("form")
      .send({
        thread_id: threadId,
        reply_id: replyId,
        delete_password: replyPass,
      });
    assert.equal(res.status, 200);
    assert.equal(res.text, "success");
  });

  // 10) Borrar thread con pass correcta
  test("DELETE /api/threads/:board pass correcta", async () => {
    const res = await chai
      .request(server)
      .delete(`/api/threads/${board}`)
      .type("form")
      .send({ thread_id: threadId, delete_password: threadPass });
    assert.equal(res.status, 200);
    assert.equal(res.text, "success");
  });
});
