import React, { Component } from "react";
import ky from "ky";
import nanoEqual from "nano-equal";
import TimeAgo from "react-timeago";
import "./App.scss";

const DEFAULT_SOURCE =
  process.env.REACT_APP_DEFAULT_SOURCE || "https://buildhub2.stage.mozaws.net/";
const DEFAULT_FREQUENCY = parseInt(
  process.env.REACT_APP_DEFAULT_FREQUENCY || 10,
  10
);
const DEFAULT_FREQUENCY_UNIT =
  process.env.REACT_APP_DEFAULT_FREQUENCY_UNIT || "minutes";

const searchParams = new URLSearchParams(window.location.search);
const defaultSource = searchParams.get("s") || DEFAULT_SOURCE;
try {
  new URL(defaultSource);
} catch (ex) {
  const msg = `The URL parameter is not valid! Try harder. (${ex.toString()})`;
  alert(msg);
  throw new Error(msg);
}
const defaultFrequency = parseInt(
  searchParams.get("f") || DEFAULT_FREQUENCY,
  10
);
const defaultFrequencyUnit = searchParams.get("u") || DEFAULT_FREQUENCY_UNIT;

function getLastResultFromLocalStorage() {
  const lastresult = window.localStorage.getItem("lastresult");
  if (lastresult) {
    return JSON.parse(lastresult);
  }
  return null;
}

class App extends Component {
  state = {
    source: defaultSource,
    frequency: defaultFrequency,
    frequencyUnit: defaultFrequencyUnit,
    loading: true,
    result: null,
    lastResult: getLastResultFromLocalStorage(),
    lookups: 0,
    serverError: null
  };
  async componentDidMount() {
    this.loop();
  }

  componentWillUnmount() {
    this.dismounted = true;
  }

  getSeconds = () => {
    let seconds = this.state.frequency;
    if (this.state.frequencyUnit === "minutes") {
      seconds *= 60;
    } else if (this.state.frequencyUnit === "hours") {
      seconds *= 60 * 60;
    }
    return seconds;
  };

  loop = async () => {
    if (this.dismounted) return;
    await this.fetch();
    const seconds = this.getSeconds();
    this.setState({ start: new Date().getTime() });
    window.setTimeout(this.loop, seconds * 1000);
  };

  fetch = async () => {
    const url = new URL("/api/search", this.state.source);

    const search = {
      aggs: {
        products: {
          filter: { match_all: {} },
          aggs: {
            "source.product": { terms: { field: "source.product", size: 50 } },
            "source.product_count": { cardinality: { field: "source.product" } }
          }
        }
      },
      size: 0,
      sort: [{ "download.date": "desc" }],
      highlight: {
        fields: {
          "source.product": {},
          "target.channel": {},
          "target.version": {},
          "target.locale": {},
          "target.platform": {},
          "build.id": {}
        }
      }
    };
    try {
      const response = await ky.post(url.href, { json: search });
      if (response.ok) {
        const json = await response.json();
        this.setState(
          {
            result: json,
            lookups: this.state.lookups + 1,
            serverError: null
          },
          () => {
            window.localStorage.setItem(
              "lastresult",
              JSON.stringify({
                result: this.state.result,
                timestamp: new Date().getTime()
              })
            );
          }
        );
      } else {
        this.setState({
          serverError: response,
          lookups: this.state.lookups + 1
        });
      }
    } catch (ex) {
      console.warn("EXCEPTION:", ex);
      this.setState({
        serverError: ex,
        lookups: this.state.lookups + 1
      });
    }
  };

  render() {
    return (
      <div>
        <section className="section">
          <div className="container">
            <header className="header">
              <h1 className="title is-3">Fresh Off The Build</h1>
              <p className="subtitle is-6">
                What's Most Recently Built in Mozilla TaskCluster.
                <br />
                Basically, keeping an eye on fresh data in Buildhub.
              </p>
            </header>
            {this.state.serverError && (
              <ShowServerError error={this.state.serverError} />
            )}

            {this.state.result && (
              <ShowAggregates
                aggregates={this.state.result.aggregations}
                lastResult={this.state.lastResult}
              />
            )}

            {this.state.start && (
              <ShowProgressBar
                seconds={this.getSeconds()}
                start={this.state.start}
              />
            )}

            {this.state.lookups > 0 ? (
              <ShowLookups lookups={this.state.lookups} />
            ) : (
              <p style={{ textAlign: "center" }}>
                <i>Lookups haven't start yet.</i>
              </p>
            )}
            {this.state.start && (
              <button
                className="button is-small"
                onClick={async event => {
                  event.preventDefault();
                  this.setState({ start: new Date().getTime() });
                  await this.fetch();
                }}
              >
                Force Refresh Now
              </button>
            )}
            <hr />
            <form action=".">
              <div className="field is-horizontal">
                <div className="field-label is-normal">
                  <label className="label">Source</label>
                </div>
                <div className="field-body">
                  <div className="field">
                    <div className="control">
                      <input
                        className="input"
                        type="url"
                        name="s"
                        defaultValue={this.state.source}
                        placeholder={`Source URL e.g. ${DEFAULT_SOURCE}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="field is-horizontal">
                <div className="field-label is-normal">
                  <label className="label">Update Frequency</label>
                </div>

                <div className="field-body">
                  <div className="field">
                    <div className="field has-addons">
                      <div className="control">
                        <input
                          className="input"
                          type="number"
                          name="f"
                          defaultValue={this.state.frequency}
                          placeholder={`Number of seconds between checks. E.g. ${DEFAULT_FREQUENCY}`}
                        />{" "}
                      </div>
                      <p className="control">
                        <span className="select">
                          <select
                            name="u"
                            defaultValue={this.state.frequencyUnit}
                          >
                            <option>seconds</option>
                            <option>minutes</option>
                            <option>hours</option>
                          </select>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="field is-horizontal">
                <div className="field-label">
                  {/* Left empty for spacing  */}
                </div>
                <div className="field-body">
                  <div className="control">
                    <button className="button is-primary">
                      Change Options
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </section>
        <footer className="footer">
          <div className="content has-text-centered is-small">
            <DisplayVersion />
          </div>
        </footer>
      </div>
    );
  }
}

export default App;

const DisplayVersion = React.memo(() => {
  const element = document.querySelector("#_version");
  const data = Object.assign({}, element.dataset);
  return (
    <p className="version-info">
      <a
        href="https://github.com/peterbe/chiveproxy"
        target="_blank"
        rel="noopener noreferrer"
      >
        FreshOffTheBuild
      </a>
      <br />
      Version{" "}
      <a
        href={`https://github.com/peterbe/freshoffthebuild/commit/${
          data.commit
        }`}
        title={data.date}
      >
        {data.commit.slice(0, 7)}
      </a>{" "}
      {data.date}
    </p>
  );
});

function ShowServerError({ error }) {
  const isResponseError = error instanceof window.Response;
  return (
    <article className="message is-danger">
      <div className="message-header">
        <p>{isResponseError ? "Server Error" : "Network Error"}</p>
      </div>
      <div className="message-body">
        {isResponseError ? (
          <p>
            <b>{error.status}</b> on <b>{error.url}</b>
          </p>
        ) : (
          <code>{error.toString()}</code>
        )}
      </div>
    </article>
  );
}

function ShowLookups({ lookups }) {
  return (
    <p>
      <small>
        Number of lookups made: <b>{lookups.toLocaleString()}</b>
      </small>
    </p>
  );
}

class ShowProgressBar extends React.PureComponent {
  state = {
    secondsLeft: 0,
    percentage: 0
  };

  componentDidMount() {
    this.loop();
  }

  loop = () => {
    const { start, seconds } = this.props;
    const finish = start + seconds * 1000;
    const total = finish - start;
    const now = new Date().getTime();
    const done = now - start;
    const secondsLeft = Math.ceil((total - done) / 1000);
    const percentage = Math.ceil((100 * done) / total);
    this.setState({ secondsLeft, percentage });
    window.setTimeout(this.loop, 1000);
  };

  componentDidUpdate() {
    const element = document.querySelector("#progress");
    element.style.width = `${this.state.percentage}%`;
  }

  render() {
    const { secondsLeft } = this.state;
    return (
      <div>
        <div id="progress">
          <b />
          <i />
        </div>
        <small>
          Time until next check: <b>{showSecondsHuman(secondsLeft)}</b>
        </small>
      </div>
    );
  }
}

function showSecondsHuman(seconds) {
  if (seconds > 3600) {
    const hours = Math.trunc(seconds / 3600);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  } else if (seconds > 60) {
    const minutes = Math.trunc(seconds / 60);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  } else {
    return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }
}

class ShowAggregates extends React.PureComponent {
  state = { previous: this.props.aggregates, initial: this.props.aggregates };

  componentDidUpdate(prevProps) {
    if (!nanoEqual(prevProps.aggregates, this.props.aggregates)) {
      this.setState({ previous: prevProps.aggregates });
    }
  }
  render() {
    const { aggregates, lastResult } = this.props;
    function packageProducts(aggs) {
      return aggs.products["source.product"].buckets.map(bucket => {
        return { name: bucket.key, count: bucket.doc_count };
      });
    }
    const products = packageProducts(aggregates);
    let previousProducts = null;
    let initialProducts = null;
    if (!nanoEqual(aggregates, this.state.previous)) {
      previousProducts = packageProducts(this.state.previous);
      if (!nanoEqual(this.state.previous, this.state.initial)) {
        initialProducts = packageProducts(this.state.initial);
      }
    }
    let topMargin = 50;
    if (window.innerHeight > 1000) {
      topMargin += 200;
    }
    if (previousProducts) {
      topMargin -= 50;
      if (initialProducts) {
        topMargin -= 50;
      }
    }

    let lastProducts = null;
    let lastResultTime = null;
    if (this.props.lastResult) {
      if (
        !nanoEqual(aggregates, lastResult.result.aggregations) &&
        !nanoEqual(this.state.previous, lastResult.result.aggregations) &&
        !nanoEqual(this.state.initial, lastResult.result.aggregations)
      ) {
        lastResultTime = lastResult.timestamp;
        lastProducts = packageProducts(lastResult.result.aggregations);
      }
    }

    return (
      <div style={{ margin: `${topMargin}px 20px` }}>
        {previousProducts && <p>Current:</p>}
        <ShowProducts products={products} />
        {previousProducts && <p>Before:</p>}
        {previousProducts && (
          <ShowProducts products={previousProducts} extraClassname="before" />
        )}
        {initialProducts && <p>Initial:</p>}
        {initialProducts && (
          <ShowProducts products={initialProducts} extraClassname="initial" />
        )}
        {lastResultTime && (
          <p>
            Last time you visited (<TimeAgo date={lastResultTime} />)
          </p>
        )}
        {lastProducts && (
          <ShowProducts products={lastProducts} extraClassname="last" />
        )}
      </div>
    );
  }
}

function ShowProducts({ products, extraClassname = " " }) {
  return (
    <nav className={`level ${extraClassname}`}>
      {products.map(product => (
        <div className="level-item has-text-centered" key={product.name}>
          <div>
            <p className="heading">{product.name}</p>
            <p className="title">{product.count.toLocaleString()}</p>
          </div>
        </div>
      ))}
    </nav>
  );
}
