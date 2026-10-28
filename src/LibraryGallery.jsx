import { useEffect, useRef } from "react";
import './library-gallery.css';

// Real photographs of UGA library buildings. These are linked from their original
// publishers for a design preview; obtain permission before public deployment.
const LIBRARY_IMAGES = {
  'main library': 'https://npr.brightspotcdn.com/dims4/default/4b306a1/2147483647/strip/true/crop/600x397%2B0%2B0/resize/880x582%21/quality/90/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Flegacy%2Fsites%2Fwuga%2Ffiles%2F202004%2Fuga_main_library.jpg',
  'mcbay science': 'https://library.uga.edu/sites/default/files/inline-images/libs2.jpg',
  'mcbay science library': 'https://library.uga.edu/sites/default/files/inline-images/libs2.jpg',
  'miller learning center': 'https://libraries.uga.edu/sites/default/files/inline-images/libs3.jpg',
  'art library': 'https://library.uga.edu/sites/default/files/inline-images/libs5.jpg',
  'carnegie': '/libraries/carnegie.jpg',
    'carnegie library': '/libraries/carnegie.jpg',
    'carnegie library learning center': '/libraries/carnegie.jpg',
};

const LIBRARY_COLORS = ['#a77d60', '#92705b', '#b9a283', '#8b786c', '#b38f74'];

export default function LibraryGallery({ locations = [], onChoose }) {

  
const track = useRef(null);
const group = useRef(null);
const paused = useRef(false);
const position = useRef(0);

useEffect(() => {
  const container = track.current;
  const firstGroup = group.current;

  if (!container || !firstGroup) return;

  let frame;
  let previousTime;

  const animate = (time) => {
    if (previousTime === undefined) previousTime = time;

    const delta = Math.min(time - previousTime, 50);
    previousTime = time;

    const loopWidth = firstGroup.offsetWidth;

    if (!paused.current && loopWidth > 0) {
      position.current += (delta / 1000) * 12;
    }

    if (loopWidth > 0) {
      position.current =
        ((position.current % loopWidth) + loopWidth) % loopWidth;
    }

    container.scrollLeft = position.current;
    frame = requestAnimationFrame(animate);
  };

  frame = requestAnimationFrame(animate);

  return () => cancelAnimationFrame(frame);
}, [locations.length]);

useEffect(() => {
  const container = track.current;

  if (!container) return;

    const handleWheel = (event) => {
      if (!paused.current) return;

      // Keep the page from scrolling when navigating the gallery.
      event.preventDefault();

      const amount =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;

      const loopWidth = group.current?.offsetWidth || 0;
      if (!loopWidth) return;

      position.current =
        (((position.current + amount) % loopWidth) + loopWidth) % loopWidth;

      container.scrollLeft = position.current;
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => container.removeEventListener("wheel", handleWheel);
  }, []);


  return (
    <section className="library-gallery section" aria-labelledby="library-gallery-title">
      <div className="library-gallery-heading">
        <div>
          <span className="library-gallery-eyebrow">YOUR NEXT CHAPTER STARTS HERE / 01—05</span>
          <h2 id="library-gallery-title">Make room for<br /><em>something good.</em></h2>
        </div>
        <div className="library-gallery-intro">
          <p>Every good study session starts somewhere. Explore our campus spaces and find the one that feels right.</p>
        </div>
      </div>
      <div
        className="library-gallery-track"
        ref={track}
        onMouseEnter={() => {
          paused.current = true;
        }}
        onMouseLeave={() => {
          paused.current = false;
        }}
      >
        <div className="library-gallery-marquee">
          {[0, 1].map((copy) => (
            <div
              className="library-gallery-group"
              key={copy}
              ref={copy === 0 ? group : null}
              aria-hidden={copy === 1 ? "true" : undefined}
            >
              {locations.map((location, index) => (
          <button
            key={location.id}
            tabIndex={copy === 1 ? -1 : 0}
            className="library-gallery-card"
            type="button"
            onClick={() => onChoose(location)}
            aria-label={`Find rooms at ${location.name}`}
            style={{ '--library-card-bg': LIBRARY_COLORS[index % LIBRARY_COLORS.length] }}
          >
            <span className="library-gallery-image-wrap">
              <img
                src={
                    location.name.toLowerCase().includes('carnegie')
                        ? '/libraries/carnegie.jpg'
                        : LIBRARY_IMAGES[location.name.toLowerCase().trim()] ||
                        '/libraries/default.jpg'
                }
                alt={`Exterior or interior of ${location.name}`}
                loading="lazy"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
              <span className="library-gallery-visit">Explore rooms <span aria-hidden="true">↗</span></span>
            </span>
            <span className="library-gallery-meta"><span>{String(index + 1).padStart(2, '0')} / CAMPUS LIBRARY</span><span aria-hidden="true">↗</span></span>
            <span className="library-gallery-name">{location.name}</span>
          </button>
          ))}
        </div>
      ))}
    </div>
  </div>
      <div className="library-gallery-bottom">
        <span>HOVER TO PAUSE / EXPLORE</span>
        <span>SELECT A LIBRARY TO FIND A ROOM ↗</span>
      </div>
    </section>
  );
}
