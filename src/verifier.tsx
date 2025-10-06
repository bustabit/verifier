import { useState, useRef, useEffect } from "react";
import {
  Button,
  Col,
  Container,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { SubmitHandler, useForm } from "react-hook-form";

import {
  TERMINATING_HASH,
  PREV_CHAIN_LENGTH,
  PREV_TERMINATING_HASH,
} from "./constants";
import { GameResult, VerificationValues } from "./verifier.worker";

export default function Verifier() {
  const [results, setResults] = useState<Array<GameResult>>([]);
  const [terminatingHash, setTerminatingHash] = useState<string | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingFinalHash, setIsLoadingFinalHash] = useState(false);

  const workerRef = useRef<Worker | null>();

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const params = new URLSearchParams(window.location.search);

  const {
    formState: { isValid },
    handleSubmit,
    register,
    watch,
  } = useForm<VerificationValues>({
    defaultValues: {
      iterations: 10,
      verifyChain: false,
      gameHash: params.get("hash") || "",
      gameNumber: params.has("game")
        ? parseInt(params.get("game") || "0")
        : undefined,
    },
  });

  // do all the heavy work in a worker to avoid blocking the main thread
  const startWebWorker = (values: VerificationValues) => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    workerRef.current = new Worker(
      new URL("./verifier.worker.ts", import.meta.url),
      {
        type: "module",
      }
    );

    // update the UI when the worker posts messages
    workerRef.current.addEventListener("message", (response) => {
      const { gameResult, done, terminatingHash } = response.data;
      if (done) {
        setIsLoadingResults(false);
      } else if (gameResult) {
        setResults((prev) => [...prev, gameResult]);
      } else if (terminatingHash) {
        setIsLoadingFinalHash(false);
        setTerminatingHash(response.data.terminatingHash);
      }
    });

    workerRef.current.postMessage(values);
  };

  const onSubmit: SubmitHandler<VerificationValues> = async (values) => {
    setIsLoadingResults(true);
    if (values.verifyChain) {
      setIsLoadingFinalHash(true);
    }
    setResults([]);
    setTerminatingHash(null);
    startWebWorker(values);
  };

  const verifyChain = watch("verifyChain");
  const isCurrentChain = watch("gameNumber") > PREV_CHAIN_LENGTH;
  const isLoading = isLoadingResults || isLoadingFinalHash;

  return (
    <Container fluid className="p-4">
      <Row className="mb-0">
        <Col>
          <h1 className="mb-0">bustabit game verifier</h1>
          <small>
            <a
              href="https://github.com/bustabit/verifier"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
              }}
            >
              source code
            </a>{" "}
            |{" "}
            <a
              href="https://bitcointalk.org/index.php?topic=5560454"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
              }}
            >
              seeding event
            </a>
          </small>
        </Col>
      </Row>

      <Row className="mt-3 mb-2">
        <Col>
          <p>
            bustabit is provably fair, which means that players themselves can
            verify that the game outcomes were decided fairly. Here's how:
          </p>
          <ol>
            <li>
              Open the game information page of the game you'd like to verify.
              Copy & paste the hash and game number to the form below.
            </li>
            <li>
              Verify that the calculated game bust and hash in the table match
              the information on the game information page.
            </li>
            <li>
              Verify that the terminating hash matches the hash of the chain's
              last element.
            </li>
          </ol>
        </Col>
      </Row>

      <Row>
        <Col>
          <Form onSubmit={handleSubmit(onSubmit)}>
            <Form.Group className="mb-3">
              <InputGroup>
                <InputGroup.Text>Game hash</InputGroup.Text>
                <Form.Control
                  disabled={isLoading}
                  {...register("gameHash", {
                    required: true,
                    minLength: 64,
                    maxLength: 64,
                  })}
                />
              </InputGroup>
            </Form.Group>
            <Form.Group className="mb-2">
              <InputGroup>
                <InputGroup.Text>Game number</InputGroup.Text>
                <Form.Control
                  disabled={isLoading}
                  type="number"
                  {...register("gameNumber", {
                    required: true,
                    min: 1,
                    valueAsNumber: true,
                  })}
                />
              </InputGroup>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Text className="text-muted">
                How many games do you want to verify?
              </Form.Text>
              <InputGroup>
                <InputGroup.Text>Iterations</InputGroup.Text>
                <Form.Control
                  disabled={isLoading}
                  type="number"
                  {...register("iterations", {
                    required: true,
                    min: 1,
                    max: 1000,
                  })}
                />
              </InputGroup>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                disabled={isLoading}
                label="Verify terminating hash"
                {...register("verifyChain")}
              />
            </Form.Group>
            <Button disabled={isLoading || !isValid} type="submit">
              Verify games {verifyChain ? "and terminating hash" : ""}
            </Button>
          </Form>
        </Col>
      </Row>

      {verifyChain ? (
        <Row className="mt-4">
          <Col>
            {isLoadingFinalHash ? (
              <>
                Hold tight, hashing through the hash chain to find terminating
                hash <Spinner animation="border" size="sm" />
              </>
            ) : (
              terminatingHash && (
                <>
                  <InputGroup>
                    <InputGroup.Text>Terminating hash</InputGroup.Text>
                    <Form.Control readOnly value={terminatingHash!} />
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Which matches commitment:{" "}
                    <span>
                      {terminatingHash ===
                      (isCurrentChain
                        ? TERMINATING_HASH
                        : PREV_TERMINATING_HASH)
                        ? "✅"
                        : "❌"}
                    </span>
                  </Form.Text>
                </>
              )
            )}
          </Col>
        </Row>
      ) : null}

      <Row className="mt-2">
        <Col>
          {results.length ? (
            <>
              <Table striped hover responsive borderless>
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Bust</th>
                    <th>Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id}>
                      <td>
                        <a
                          href={"https://bustabit.com/game/" + result.id}
                          target="_blank"
                          style={{
                            color: "inherit",
                            textDecoration: "none",
                          }}
                        >
                          {result.id}
                        </a>
                      </td>
                      <td
                        style={{ color: result.bust >= 1.98 ? "green" : "red" }}
                      >
                        {result.bust}x
                      </td>
                      <td>{result.hash}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>{" "}
              {isLoadingResults && (
                <>
                  Loading more game results{" "}
                  <Spinner animation="border" size="sm" />
                </>
              )}
            </>
          ) : (
            isLoadingResults && (
              <div className="mt-3">
                Loading game results <Spinner animation="border" size="sm" />
              </div>
            )
          )}
        </Col>
      </Row>
    </Container>
  );
}
