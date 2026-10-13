import { useState } from 'react'

const TEAM = [
  { id: 'blank', name: 'Blank', role: 'Owner', src: '/itachi-headband.jpg?v=8', rgb: '200, 16, 46' },
  { id: 'nouzen', name: 'Nouzen', role: 'App Developer', src: '/team/sasuke.jpg?v=4', rgb: '124, 63, 214' },
  { id: 'fraudhelp', name: 'fraudhelp', role: 'Discord Manager', src: '/team/madara.jpg', rgb: '46, 140, 230' },
  { id: 'drozxbtw', name: 'Droxzbtw', role: 'Marketing Specialist / Editor', src: '/team/obito.jpg', rgb: '224, 112, 28' },
  { id: 'murder', name: 'Murder', role: 'Aim Bundle Developer / Staff', src: '/team/kakashi.jpg', rgb: '108, 132, 158' },
  { id: 'xeno', name: 'Xeno', role: 'Discord Ticket Support / Staff', src: '/team/shisui.jpg', rgb: '36, 148, 92' },
]

export default function TeamPage() {
  const [id, setId] = useState(TEAM[0].id)
  const member = TEAM.find((item) => item.id === id) || TEAM[0]

  return (
    <section className="blank-team" aria-label="Team" style={{ '--team-rgb': member.rgb }}>
      <article className="blank-team__card">
        <div className="blank-team__character" aria-hidden="true">
          <img className="blank-team__portrait" src={member.src} alt="" />
        </div>
        <div className="blank-team__panel">
          <p className="blank-team__kicker">Team</p>
          <h1>{member.name}</h1>
          <p className="blank-team__role">{member.role}</p>
          <div className="blank-team__list" role="listbox" aria-label="Team members">
            {TEAM.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === member.id}
                className={item.id === member.id ? 'is-on' : ''}
                onClick={() => setId(item.id)}
              >
                <strong>{item.name}</strong>
                <em>{item.role}</em>
              </button>
            ))}
          </div>
        </div>
      </article>
    </section>
  )
}
